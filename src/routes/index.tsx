import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toJpeg } from "html-to-image";
import { extractProduct, fetchImage } from "@/lib/product.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gerador de Encartes de Supermercado" },
      { name: "description", content: "Cole o link de um produto e gere um encarte promocional pronto para imprimir." },
      { property: "og:title", content: "Gerador de Encartes de Supermercado" },
      { property: "og:description", content: "Do link do produto ao encarte A4 em segundos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Store = { name: string; color: string; logo: string };
type Highlight = "oferta" | "leve" | "imperdivel" | "nenhum";
const HL: Record<Highlight, string> = { oferta: "OFERTA", leve: "LEVE JÁ", imperdivel: "IMPERDÍVEL", nenhum: "" };

function Index() {
  const extract = useServerFn(extractProduct);
  const getImg = useServerFn(fetchImage);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [p, setP] = useState({ name: "", description: "", price: "", oldPrice: "", unit: "un", image: "" });
  const [hl, setHl] = useState<Highlight>("oferta");
  const [store, setStore] = useState<Store>({ name: "Meu Supermercado", color: "#d62828", logo: "" });
  const [imgUrl, setImgUrl] = useState("");
  const flyerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = localStorage.getItem("encarte-store");
    if (s) try { setStore(JSON.parse(s)); } catch { /* ignore */ }
  }, []);
  const saveStore = (s: Store) => { setStore(s); localStorage.setItem("encarte-store", JSON.stringify(s)); };

  async function onFetch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const r = await extract({ data: { url } });
      if (!r.ok) setMsg({ type: "error", text: r.error });
      else {
        setP((o) => ({ ...o, ...r.product }));
        setMsg(r.warning ? { type: "error", text: r.warning } : { type: "ok", text: "Dados encontrados! Confira e ajuste abaixo." });
      }
    } catch {
      setMsg({ type: "error", text: "Link inválido ou site indisponível. Preencha os dados manualmente." });
    } finally { setLoading(false); }
  }

  const readFile = (f: File, cb: (s: string) => void) => { const r = new FileReader(); r.onload = () => cb(String(r.result)); r.readAsDataURL(f); };

  async function loadImgUrl() {
    if (!imgUrl) return;
    try { const r = await getImg({ data: { url: imgUrl } }); if (r.image) setP({ ...p, image: r.image }); else setMsg({ type: "error", text: "Não consegui baixar essa imagem." }); }
    catch { setMsg({ type: "error", text: "Link de imagem inválido." }); }
  }

  async function saveJpg() {
    if (!flyerRef.current) return;
    const data = await toJpeg(flyerRef.current, { quality: 0.95, pixelRatio: 3, style: { transform: "none" } });
    const a = document.createElement("a"); a.href = data; a.download = `encarte-${(p.name || "produto").slice(0, 30)}.jpg`; a.click();
  }

  const [reais, cents] = (p.price || "0,00").split(",");

  return (
    <div className="min-h-screen font-sans">
      <header className="bg-brand text-brand-foreground">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <h1 className="font-display text-3xl tracking-wide">GERADOR DE ENCARTES</h1>
          <p className="opacity-90">Cole o link do produto, confira os dados e imprima.</p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[1fr_auto]">
        <div className="space-y-6">
          <form onSubmit={onFetch} className="rounded-lg border bg-card p-5 space-y-3">
            <Label htmlFor="url" className="font-semibold">1. Link do produto</Label>
            <div className="flex gap-2">
              <Input id="url" type="url" required placeholder="https://www.supermercado.com.br/produto..." value={url} onChange={(e) => setUrl(e.target.value)} />
              <Button type="submit" disabled={loading}>{loading ? "Buscando..." : "Buscar"}</Button>
            </div>
            {msg && <p className={msg.type === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.text}</p>}
          </form>

          <section className="rounded-lg border bg-card p-5 space-y-3">
            <h2 className="font-semibold">2. Dados do produto</h2>
            <div><Label>Nome</Label><Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
            <div><Label>Descrição curta</Label><Textarea rows={3} value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Preço (R$)</Label><Input placeholder="9,99" value={p.price} onChange={(e) => setP({ ...p, price: e.target.value })} /></div>
              <div><Label>De (opcional)</Label><Input placeholder="12,99" value={p.oldPrice} onChange={(e) => setP({ ...p, oldPrice: e.target.value })} /></div>
              <div><Label>Unidade</Label><Input value={p.unit} onChange={(e) => setP({ ...p, unit: e.target.value })} /></div>
            </div>
            <div>
              <Label>Destaque do preço</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {(Object.keys(HL) as Highlight[]).map((k) => (
                  <Button key={k} type="button" size="sm" variant={hl === k ? "default" : "outline"} onClick={() => setHl(k)}>{HL[k] || "Sem selo"}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Foto</Label>
              <div className="flex gap-2">
                <Input placeholder="Link da imagem (opcional)" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} />
                <Button type="button" variant="outline" onClick={loadImgUrl}>Usar</Button>
              </div>
              <div className="flex items-center gap-2">
                <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], (s) => setP({ ...p, image: s }))} />
                {p.image && <Button type="button" variant="ghost" onClick={() => setP({ ...p, image: "" })}>Remover</Button>}
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-5 space-y-3">
            <h2 className="font-semibold">3. Sua loja <span className="text-xs font-normal text-muted-foreground">(fica salvo neste navegador)</span></h2>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div><Label>Nome da loja</Label><Input value={store.name} onChange={(e) => saveStore({ ...store, name: e.target.value })} /></div>
              <div><Label>Cor</Label><Input type="color" className="w-16 p-1" value={store.color} onChange={(e) => saveStore({ ...store, color: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], (s) => saveStore({ ...store, logo: s }))} />
              {store.logo && <Button type="button" variant="ghost" onClick={() => saveStore({ ...store, logo: "" })}>Remover logo</Button>}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => window.print()} className="flex-1">Imprimir / PDF</Button>
            <Button variant="outline" onClick={saveJpg} className="flex-1">Baixar JPG</Button>
          </div>
          {/* Flyer: store color is user data, applied via inline CSS variable */}
          <div className="h-[594px] w-[420px] overflow-hidden rounded shadow-xl">
            <div ref={flyerRef} className="flyer-print flex h-[1123px] w-[794px] origin-top-left scale-[0.529] flex-col bg-card text-card-foreground"
              style={{ ["--brand" as string]: store.color }}>
              <div className="flex items-center gap-6 bg-brand px-12 py-8 text-brand-foreground">
                {store.logo && <img src={store.logo} alt="" className="h-20 w-20 rounded bg-card object-contain p-1" />}
                <div className="font-display text-5xl uppercase leading-none">{store.name}</div>
              </div>
              <div className="relative flex flex-1 items-center justify-center px-12 pt-8">
                {p.image ? <img src={p.image} alt="" className="max-h-[520px] max-w-full object-contain" />
                  : <div className="flex h-[480px] w-full items-center justify-center rounded-xl border-4 border-dashed text-4xl font-semibold text-muted-foreground">sem foto</div>}
                {HL[hl] && <div className="absolute right-10 top-8 -rotate-6 rounded bg-price px-6 py-3 font-display text-4xl text-price-foreground shadow-lg">{HL[hl]}</div>}
              </div>
              <div className="px-12 pb-4 pt-6">
                <h2 className="font-display text-6xl uppercase leading-[1.05] line-clamp-2">{p.name || "Nome do produto"}</h2>
                {p.description && <p className="mt-3 text-2xl text-muted-foreground line-clamp-3">{p.description}</p>}
              </div>
              <div className="mx-12 mb-12 flex items-end justify-between rounded-2xl bg-brand px-10 py-6 text-brand-foreground">
                <div className="text-2xl font-semibold">
                  {p.oldPrice && <div className="line-through opacity-80">De R$ {p.oldPrice}</div>}
                  <div>{p.oldPrice ? "Por apenas" : "Apenas"}</div>
                </div>
                <div className="flex items-start font-display leading-none">
                  <span className="mt-4 mr-2 text-4xl">R$</span>
                  <span className="text-[150px]">{reais}</span>
                  <span className="flex flex-col"><span className="text-6xl">,{cents || "00"}</span><span className="text-2xl font-sans font-semibold">/{p.unit}</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
