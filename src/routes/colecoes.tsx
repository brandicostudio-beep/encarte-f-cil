import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { getClientSession } from "@/lib/auth-constants";
import {
  COLLECTION_TEMPLATE_STORAGE_KEY,
  DEFAULT_COLLECTION_TEMPLATE,
  DEFAULT_COLLECTION_BACKGROUND,
  DEFAULT_COLLECTION_GRID,
  computeGridCells,
  cellsPerPage,
  parseColumnLines,
  sanitizeGrid,
  type CollectionTemplateConfig,
} from "@/lib/collection-template";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, ImagePlus, RotateCcw, Grid3x3, LayoutGrid, SlidersHorizontal } from "lucide-react";
import { ColecoesWorkspace } from "@/components/colecoes/ColecoesWorkspace";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/colecoes")({
  head: () => ({
    meta: [
      { title: "Encarte de Coleções 9:16 - Fundo e grade configuráveis" },
      { name: "description", content: "Monte encartes de coleções com arte de fundo trocável e grade de produtos ajustável." },
      { property: "og:title", content: "Encarte de Coleções 9:16" },
      { property: "og:description", content: "Arte de fundo trocável e grade de produtos ajustável para encartes de coleções." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ColecoesPage,
});

const PREVIEW_W = 405;

function ColecoesPage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [config, setConfig] = useState<CollectionTemplateConfig>(DEFAULT_COLLECTION_TEMPLATE);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"workspace" | "template">("workspace");
  const [columnsText, setColumnsText] = useState(DEFAULT_COLLECTION_GRID.columnLines.join(", "));
  const [showGrid, setShowGrid] = useState(true);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!getClientSession()) {
      navigate({ to: "/acesso", search: { redirect: "/colecoes" } as never });
      return;
    }
    setAuthed(true);
    try {
      const raw = localStorage.getItem(COLLECTION_TEMPLATE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CollectionTemplateConfig>;
        const grid = sanitizeGrid(parsed.grid);
        setConfig({ backgroundImage: parsed.backgroundImage || DEFAULT_COLLECTION_BACKGROUND, grid });
        setColumnsText(grid.columnLines.join(", "));
      }
    } catch {
      /* config corrompida: mantém o padrão */
    }
    setLoaded(true);
  }, [navigate]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(COLLECTION_TEMPLATE_STORAGE_KEY, JSON.stringify(config));
    } catch {
      setError("Não foi possível salvar a arte no navegador (arquivo muito grande). Ela vale só nesta sessão.");
    }
  }, [config, loaded]);

  const grid = config.grid;
  const cells = useMemo(() => computeGridCells(grid), [grid]);
  const scale = PREVIEW_W / grid.canvasWidth;

  const updateGrid = (patch: Partial<typeof grid>) =>
    setConfig((c) => ({ ...c, grid: sanitizeGrid({ ...c.grid, ...patch }) }));

  const onBackground = (file: File | undefined) => {
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const img = new Image();
      img.onload = () => {
        // Usa o tamanho real da nova arte como canvas base, mantendo a grade proporcional.
        setConfig((c) => {
          const sx = img.naturalWidth / c.grid.canvasWidth;
          const sy = img.naturalHeight / c.grid.canvasHeight;
          const g = c.grid;
          const nextGrid = sanitizeGrid({
            ...g,
            canvasWidth: img.naturalWidth,
            canvasHeight: img.naturalHeight,
            top: Math.round(g.top * sy),
            bottom: Math.round(g.bottom * sy),
            columnLines: g.columnLines.map((x) => Math.round(x * sx)),
          });
          setColumnsText(nextGrid.columnLines.join(", "));
          return { backgroundImage: url, grid: nextGrid };
        });
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const resetAll = () => {
    setConfig(DEFAULT_COLLECTION_TEMPLATE);
    setColumnsText(DEFAULT_COLLECTION_GRID.columnLines.join(", "));
  };

  const exportJpg = async () => {
    if (!canvasRef.current) return;
    const prev = showGrid;
    setShowGrid(false);
    await new Promise((r) => setTimeout(r, 50));
    try {
      const { toJpeg } = await import("html-to-image");
      const dataUrl = await toJpeg(canvasRef.current, {
        quality: 0.95,
        pixelRatio: grid.canvasWidth / PREVIEW_W,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "encarte-colecoes.jpg";
      a.click();
    } finally {
      setShowGrid(prev);
    }
  };

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" />Encarte de validade</Link>
          </Button>
          <h1 className="truncate text-lg font-bold">Encarte de Coleções</h1>
        </div>
        {/* Alternador de visualização: Catálogo de Produtos x Ajuste de Fundo/Grade */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
          <Button
            type="button"
            size="sm"
            variant={activeTab === "workspace" ? "default" : "ghost"}
            onClick={() => setActiveTab("workspace")}
            className="text-xs h-8"
          >
            <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
            Catálogo & Páginas
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === "template" ? "default" : "ghost"}
            onClick={() => setActiveTab("template")}
            className="text-xs h-8"
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            Calibrar Grade
          </Button>
        </div>

        {activeTab === "template" && (
          <Button size="sm" onClick={exportJpg}><Download className="mr-1 h-4 w-4" />Baixar JPG</Button>
        )}
      </header>

      {activeTab === "workspace" ? (
        <main className="mx-auto max-w-7xl p-4">
          <ColecoesWorkspace />
        </main>
      ) : (
        <main className="mx-auto grid max-w-6xl gap-6 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <section className="space-y-5">
          <div className="space-y-2 rounded-lg border border-border p-4">
            <h2 className="font-semibold">Arte de fundo</h2>
            <p className="text-sm text-muted-foreground">
              O fundo é só a arte (com o cabeçalho dela). Envie outra arte para trocar — a grade se ajusta ao novo tamanho.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <label className="cursor-pointer">
                  <ImagePlus className="mr-1 h-4 w-4" />Enviar nova arte
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" data-testid="bg-upload"
                    onChange={(e) => onBackground(e.target.files?.[0])} />
                </label>
              </Button>
              <Button variant="ghost" size="sm" onClick={resetAll}><RotateCcw className="mr-1 h-4 w-4" />Voltar ao padrão</Button>
            </div>
            <p className="text-xs text-muted-foreground">Tamanho base: {grid.canvasWidth} × {grid.canvasHeight} px</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Área da grade</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowGrid((s) => !s)}>
                <Grid3x3 className="mr-1 h-4 w-4" />{showGrid ? "Ocultar guias" : "Mostrar guias"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumField label="Topo (y)" value={grid.top} onChange={(v) => updateGrid({ top: v })} />
              <NumField label="Base (y)" value={grid.bottom} onChange={(v) => updateGrid({ bottom: v })} />
              <NumField label="Linhas" value={grid.rows} onChange={(v) => updateGrid({ rows: v })} />
              <NumField label="Espaço entre células" value={grid.gap} onChange={(v) => updateGrid({ gap: v })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cols">Divisões das colunas (x, separadas por vírgula)</Label>
              <Input id="cols" value={columnsText}
                onChange={(e) => setColumnsText(e.target.value)}
                onBlur={() => {
                  const lines = parseColumnLines(columnsText);
                  updateGrid({ columnLines: lines });
                  setColumnsText(sanitizeGrid({ ...grid, columnLines: lines }).columnLines.join(", "));
                }} />
              <p className="text-xs text-muted-foreground">
                {grid.columnLines.length - 1} colunas × {grid.rows} linhas = {cellsPerPage(grid)} produtos por página
              </p>
            </div>
          </div>
        </section>

        <div
          ref={canvasRef}
          className="relative overflow-hidden"
          style={{ width: PREVIEW_W, height: grid.canvasHeight * scale }}
          data-testid="collection-canvas"
        >
          <img src={config.backgroundImage} alt="Arte de fundo do encarte" className="absolute inset-0 h-full w-full" draggable={false} />
          {showGrid && cells.map((c) => (
            <div key={`${c.row}-${c.col}`} className="absolute border border-dashed border-primary-foreground/60"
              style={{ left: c.x * scale, top: c.y * scale, width: c.width * scale, height: c.height * scale }} />
          ))}
        </div>
      </main>
      )}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }} />
    </div>
  );
}
