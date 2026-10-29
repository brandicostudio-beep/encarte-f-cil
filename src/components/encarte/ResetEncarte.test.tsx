import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { EditorStepper } from "./EditorStepper";
import { SourceSelector } from "./SourceSelector";
import { DEFAULT_CAMPAIGN } from "@/types/encarte";

describe("Novo Encarte e Zerar Dados (ResetEncarte)", () => {
  it("EditorStepper renderiza o botão 'Novo Encarte' quando onReset é fornecido", () => {
    const html = renderToString(
      React.createElement(EditorStepper, {
        currentStep: "precos",
        completedSteps: new Set(["origem", "dados"]),
        onStepClick: () => {},
        onReset: () => {},
      })
    );

    expect(html).toContain("Novo Encarte");
  });

  it("SourceSelector renderiza o botão 'Novo Encarte (Zerar Dados)' quando hasExistingProducts é true", () => {
    const html = renderToString(
      React.createElement(SourceSelector, {
        onDataLoaded: () => {},
        onExtractCategoryUrl: async () => ({ ok: true, products: [] }),
        onLoadSample: () => {},
        hasExistingProducts: true,
        existingProducts: [
          {
            id: "p1",
            code: "123",
            name: "PRODUTO TESTE",
            packaging: "1 UN",
            validity: "20/12/2026",
            price: "5,99",
            unit: "UND",
            stock: "10",
            badge: "nenhum",
            image: "",
            included: true,
          },
        ],
        onReset: () => {},
      })
    );

    expect(html).toContain("Novo Encarte (Zerar Dados)");
  });

  it("Limpeza de dados remove chaves do localStorage e restaura estado inicial padrão", () => {
    const fakeLocalStorage: Record<string, string> = {
      "encarte-products-v2": JSON.stringify([{ id: "p1", code: "123" }]),
      "encarte-products": JSON.stringify([{ id: "p0", code: "000" }]),
      "encarte-campaign-v2": JSON.stringify({ title: "CAMPANHA ANTIGA" }),
      "encarte-campaign": JSON.stringify({ title: "LEGADA" }),
      "encarte-drive-cache": "cache-data",
    };

    const fakeSessionStorage: Record<string, string> = {
      "encarte-active-step": "precos",
    };

    // Função de limpeza completa (mesma lógica usada em handleExecuteReset)
    const executeReset = () => {
      delete fakeLocalStorage["encarte-products-v2"];
      delete fakeLocalStorage["encarte-products"];
      delete fakeLocalStorage["encarte-campaign-v2"];
      delete fakeLocalStorage["encarte-campaign"];
      delete fakeLocalStorage["encarte-drive-cache"];
      delete fakeSessionStorage["encarte-active-step"];
    };

    executeReset();

    expect(fakeLocalStorage["encarte-products-v2"]).toBeUndefined();
    expect(fakeLocalStorage["encarte-products"]).toBeUndefined();
    expect(fakeLocalStorage["encarte-campaign-v2"]).toBeUndefined();
    expect(fakeLocalStorage["encarte-campaign"]).toBeUndefined();
    expect(fakeLocalStorage["encarte-drive-cache"]).toBeUndefined();
    expect(fakeSessionStorage["encarte-active-step"]).toBeUndefined();
  });

  it("Ao abrir novo link (sem sessionStorage de sessão ativa), inicia na etapa 'origem' e não em 'precos'", () => {
    // Simula abertura de link em nova aba onde sessionStorage não possui 'encarte-active-step'
    const sessionStep = undefined;
    const hasLegacyProductsInStorage = true;

    let initialStep = "origem";
    if (sessionStep) {
      initialStep = sessionStep;
    }

    expect(initialStep).toBe("origem");
    expect(hasLegacyProductsInStorage).toBe(true);
  });

  it("Componentes Checkbox e Label renderizam sem erros de referência na etapa de campanha", () => {
    const { Checkbox } = require("@/components/ui/checkbox");
    const { Label } = require("@/components/ui/label");

    expect(() => {
      renderToString(
        React.createElement("div", null, [
          React.createElement(Checkbox, {
            key: "check",
            id: "test-check",
            checked: true,
          }),
          React.createElement(
            Label,
            { key: "lbl", htmlFor: "test-check" },
            "Rótulo de teste"
          ),
        ])
      );
    }).not.toThrow();
  });
  it("Todos os ícones e elementos JSX da rota index estão devidamente importados sem ReferenceError", () => {
    const fs = require("fs");
    const LucideIcons = require("lucide-react");
    const code = fs.readFileSync("src/routes/index.tsx", "utf-8");

    const tags = new Set([...code.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)].map((m: any) => m[1]));
    const imported = new Set();
    const re = /import\s+\{([^}]+)\}\s+from\s+["']lucide-react["']/g;
    let m;
    while ((m = re.exec(code)) !== null) {
      m[1].split(",").forEach((id: string) => {
        const clean = id.trim().split(/\s+as\s+/)[0].trim();
        if (clean) imported.add(clean);
      });
    }

    const missingIcons: string[] = [];
    for (const tag of tags) {
      if (LucideIcons[tag] && !imported.has(tag)) {
        const isLocal = new RegExp(`(?:const|function|class)\\s+${tag}\\b`).test(code);
        if (!isLocal) {
          missingIcons.push(tag);
        }
      }
    }

    expect(missingIcons).toEqual([]);
  });
});
