import { describe, it, expect } from "vitest";
import {
  parseGoogleDriveUrl,
  scrapeFolderHtmlFiles,
  extractPhotosFromZipBuffer,
} from "./drive-service";
import JSZip from "jszip";

describe("Serviço de Extração do Google Drive (drive-service)", () => {
  it("Reconhece e extrai o ID de links de pastas compartilhadas do Google Drive", () => {
    const url1 = "https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs";
    const res1 = parseGoogleDriveUrl(url1);
    expect(res1).not.toBeNull();
    expect(res1?.type).toBe("folder");
    expect(res1?.id).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs");

    const url2 = "https://drive.google.com/drive/u/0/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345?usp=sharing";
    const res2 = parseGoogleDriveUrl(url2);
    expect(res2?.type).toBe("folder");
    expect(res2?.id).toBe("1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345");
  });

  it("Reconhece e extrai o ID de links de arquivos e zips do Google Drive", () => {
    const url1 = "https://drive.google.com/file/d/1XyZ9876543210AbCdEfGhIjKlMnOpQrS/view?usp=sharing";
    const res1 = parseGoogleDriveUrl(url1);
    expect(res1?.type).toBe("file");
    expect(res1?.id).toBe("1XyZ9876543210AbCdEfGhIjKlMnOpQrS");

    const url2 = "https://drive.google.com/open?id=1234567890abcdefghijklmnopqrstuv";
    const res2 = parseGoogleDriveUrl(url2);
    expect(res2?.type).toBe("file");
    expect(res2?.id).toBe("1234567890abcdefghijklmnopqrstuv");
  });

  it("Retorna null para links inválidos ou que não são do Google Drive", () => {
    expect(parseGoogleDriveUrl("")).toBeNull();
    expect(parseGoogleDriveUrl("https://example.com/photos.zip")).toBeNull();
    expect(parseGoogleDriveUrl("https://cescom.com.br/categoria")).toBeNull();
  });

  it("Raspa arquivos de imagem do HTML de uma pasta pública", () => {
    const mockHtml = `
      <html>
        <body>
          <script>
            window['_DRIVE_ivd'] = '[["1A2B3C4D5E6F7G8H9I0J-KlMnOpQrStU",["24657.jpg","image/jpeg"]],["9Z8Y7X6W5V4U3T2S1R0Q-PoNmLkJiHgF",["10982-frente.png","image/png"]]]';
          </script>
        </body>
      </html>
    `;

    const files = scrapeFolderHtmlFiles(mockHtml);
    expect(files.length).toBe(2);
    expect(files[0].id).toBe("1A2B3C4D5E6F7G8H9I0J-KlMnOpQrStU");
    expect(files[0].filename).toBe("24657.jpg");
    expect(files[1].filename).toBe("10982-frente.png");
  });

  it("Descompacta fotos de buffer ZIP e extrai códigos de produtos", async () => {
    const zip = new JSZip();
    zip.file("24657.jpg", "fake-image-bytes-1");
    zip.file("33104_frente.png", "fake-image-bytes-2");
    zip.file("relatorio.pdf", "fake-pdf-bytes");

    const buffer = await zip.generateAsync({ type: "uint8array" });
    const photos = await extractPhotosFromZipBuffer(buffer, ["24657", "33104"]);

    expect(photos.length).toBe(2);
    expect(photos.map((p) => p.extractedCode)).toContain("24657");
    expect(photos.map((p) => p.extractedCode)).toContain("33104");
  });
});
