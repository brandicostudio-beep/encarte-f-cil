import { describe, it, expect } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  HowItWorksModal,
  HowItWorksContent,
  HOW_IT_WORKS_STEPS,
} from "./HowItWorksModal";

describe("Guia 'Como funciona' - 4 Passos e Animação Simplificada", () => {
  it("Renderiza HowItWorksModal com open=false e open=true sem exceções", () => {
    expect(() => {
      renderToString(
        React.createElement(HowItWorksModal, {
          open: false,
          onOpenChange: () => {},
        })
      );
    }).not.toThrow();

    expect(() => {
      renderToString(
        React.createElement(HowItWorksModal, {
          open: true,
          onOpenChange: () => {},
        })
      );
    }).not.toThrow();
  });

  it("Possui exatamente 4 passos com linguagem direta e ações únicas", () => {
    expect(HOW_IT_WORKS_STEPS).toHaveLength(4);

    expect(HOW_IT_WORKS_STEPS[0].title).toBe("Envie a planilha ou o PDF de validade");
    expect(HOW_IT_WORKS_STEPS[0].shortAction).toContain("Escolha o arquivo");

    expect(HOW_IT_WORKS_STEPS[1].title).toBe("Cole o link do produto ou da categoria");
    expect(HOW_IT_WORKS_STEPS[1].shortAction).toContain("busca a embalagem e a unidade sozinho");

    expect(HOW_IT_WORKS_STEPS[2].title).toBe("Revise só o que estiver marcado como pendente");
    expect(HOW_IT_WORKS_STEPS[2].shortAction).toContain("Apenas corrija os itens com aviso");

    expect(HOW_IT_WORKS_STEPS[3].title).toBe("Baixe o encarte");
    expect(HOW_IT_WORKS_STEPS[3].shortAction).toContain("pronto para WhatsApp e Instagram");
  });

  it("Renderiza HowItWorksContent no Passo 1 com título, botão Próximo e ilustrações", () => {
    const html = renderToString(
      React.createElement(HowItWorksContent, {
        currentStep: 0,
        setCurrentStep: () => {},
        isPlaying: false,
        togglePlay: () => {},
        handlePrev: () => {},
        handleNext: () => {},
        handleSkip: () => {},
        prefersReducedMotion: false,
      })
    );

    const cleanHtml = html.replace(/<!-- -->/g, "");
    expect(cleanHtml).toContain("Como funciona o Geraencarte");
    expect(cleanHtml).toContain("Passo 1 de 4");
    expect(cleanHtml).toContain("Envie a planilha ou o PDF de validade");
    expect(cleanHtml).toContain("Passo 1");
    expect(cleanHtml).toContain("Passo 2");
    expect(cleanHtml).toContain("Passo 3");
    expect(cleanHtml).toContain("Passo 4");
    expect(cleanHtml).toContain("Próximo");
    expect(cleanHtml).toContain("Voltar");
    expect(cleanHtml).toContain("Pular");
    expect(cleanHtml).toContain("Reproduzir");
  });

  it("Renderiza HowItWorksContent no Passo 4 com botão 'Começar Agora'", () => {
    const html = renderToString(
      React.createElement(HowItWorksContent, {
        currentStep: 3,
        setCurrentStep: () => {},
        isPlaying: true,
        togglePlay: () => {},
        handlePrev: () => {},
        handleNext: () => {},
        handleSkip: () => {},
        prefersReducedMotion: false,
      })
    );

    const cleanHtml = html.replace(/<!-- -->/g, "");
    expect(cleanHtml).toContain("Passo 4 de 4");
    expect(cleanHtml).toContain("Baixe o encarte");
    expect(cleanHtml).toContain("Começar Agora");
    expect(cleanHtml).toContain("Pausar");
  });

  it("Respeita prefersReducedMotion ocultando controles de auto-play", () => {
    const html = renderToString(
      React.createElement(HowItWorksContent, {
        currentStep: 0,
        setCurrentStep: () => {},
        isPlaying: false,
        togglePlay: () => {},
        handlePrev: () => {},
        handleNext: () => {},
        handleSkip: () => {},
        prefersReducedMotion: true,
      })
    );

    // Quando movimento reduzido é solicitado, o botão de auto-play fica oculto
    expect(html).not.toContain("Reproduzir automaticamente");
    expect(html).not.toContain("Pausar avanço automático");
  });
});
