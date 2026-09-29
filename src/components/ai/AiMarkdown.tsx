import { Fragment } from "react";

// Render markdown ringan dari jawaban AI jadi elemen React (tanpa
// dangerouslySetInnerHTML — teks dari model tidak pernah jadi HTML).
// Didukung: paragraf, "- "/"* " poin, "1. " daftar bernomor, "#"/"##"/"###"
// judul kecil, **tebal**, *miring*, `kode`.
function inline(text: string, keyBase: string) {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) parts.push(<strong key={k} className="font-bold text-slate-900 dark:text-white">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) parts.push(<code key={k} className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em] dark:bg-slate-800">{tok.slice(1, -1)}</code>);
    else parts.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "h"; text: string };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const h = line.match(/^\s*#{1,4}\s+(.*)$/);
    const prev = blocks[blocks.length - 1];
    if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] }); // pemisah paragraf
    } else if (h) {
      blocks.push({ kind: "h", text: h[1] });
    } else if (ul) {
      if (prev?.kind === "ul") prev.items.push(ul[1]);
      else blocks.push({ kind: "ul", items: [ul[1]] });
    } else if (ol) {
      if (prev?.kind === "ol") prev.items.push(ol[1]);
      else blocks.push({ kind: "ol", items: [ol[1]] });
    } else if (prev?.kind === "p" && prev.lines.length > 0) {
      prev.lines.push(line);
    } else {
      blocks.push({ kind: "p", lines: [line] });
    }
  }
  return blocks.filter((b) => !(b.kind === "p" && b.lines.length === 0));
}

export function AiMarkdown({ text }: { text: string }) {
  const blocks = parse(text || "");
  return (
    <div className="space-y-2.5">
      {blocks.map((b, bi) => {
        const k = `b${bi}`;
        if (b.kind === "h") return <p key={k} className="font-black text-slate-900 dark:text-white">{inline(b.text, k)}</p>;
        if (b.kind === "ul")
          return (
            <ul key={k} className="space-y-1.5">
              {b.items.map((it, ii) => (
                <li key={ii} className="flex gap-2">
                  <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                  <span>{inline(it, `${k}-${ii}`)}</span>
                </li>
              ))}
            </ul>
          );
        if (b.kind === "ol")
          return (
            <ol key={k} className="space-y-1.5">
              {b.items.map((it, ii) => (
                <li key={ii} className="flex gap-2">
                  <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-black text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">{ii + 1}</span>
                  <span>{inline(it, `${k}-${ii}`)}</span>
                </li>
              ))}
            </ol>
          );
        return (
          <p key={k}>
            {b.lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, `${k}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
