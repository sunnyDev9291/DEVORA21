import { getServerApiBaseUrl } from "@/lib/api-base-url";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid multipart form data." }, { status: 400 });
  }

  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const resume = formData.get("resume");

  if (!jobTitle) {
    return Response.json({ error: "jobTitle is required." }, { status: 400 });
  }
  if (!companyName) {
    return Response.json({ error: "companyName is required." }, { status: 400 });
  }
  if (!(resume instanceof Blob) || resume.size === 0) {
    return Response.json({ error: "resume DOCX file is required." }, { status: 400 });
  }

  try {
    const upstreamForm = new FormData();
    for (const [key, value] of formData.entries()) {
      if (value instanceof Blob) {
        const fileName =
          key === "resume"
            ? String(formData.get("resumeFileName") ?? "resume.docx")
            : undefined;
        upstreamForm.append(key, value, fileName);
      } else {
        upstreamForm.append(key, value);
      }
    }

    const upstream = await fetch(`${getServerApiBaseUrl()}/resume/archive`, {
      method: "POST",
      body: upstreamForm,
    });

    const contentType = upstream.headers.get("content-type") ?? "";

    if (contentType.includes("application/pdf")) {
      const pdfBuffer = await upstream.arrayBuffer();
      const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");
      const pdfFileName =
        upstream.headers.get("x-pdf-filename") ??
        upstream.headers.get("content-disposition")?.match(/filename="?([^"]+)"?/)?.[1] ??
        "resume.pdf";
      const resumeName =
        upstream.headers.get("x-resume-name") ?? String(formData.get("resume") ?? "resume.docx");

      return Response.json({
        resumeName,
        pdfFileName,
        pdfBase64,
      });
    }

    const data = (await upstream.json()) as {
      resumeName?: string;
      pdfFileName?: string;
      pdfBase64?: string;
      error?: string;
      message?: string;
    };

    if (!upstream.ok) {
      return Response.json(
        { error: data.error || data.message || "Backend archive failed." },
        { status: upstream.status }
      );
    }

    if (!data.pdfBase64 || !data.pdfFileName) {
      return Response.json({ error: "Backend response missing PDF data." }, { status: 502 });
    }

    return Response.json({
      resumeName: data.resumeName ?? "",
      pdfFileName: data.pdfFileName,
      pdfBase64: data.pdfBase64,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach resume archive service.";
    return Response.json({ error: message }, { status: 502 });
  }
}
