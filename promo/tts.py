"""Voice-over per scene (edge-tts, suara id-ID-GadisNeural) + waktu tiap kata.

Pakai: python tts.py <plan.json> <out_dir>
Menulis <out_dir>/scene-<i>.mp3 dan <out_dir>/voice.json:
  [{"file": "scene-0.mp3", "words": [[detik_mulai, detik_selesai, "kata"], ...]}, ...]
"""
import asyncio
import json
import sys

import edge_tts

VOICE = "id-ID-GadisNeural"


async def synth(text: str, rate: str, path: str):
    words = []
    comm = edge_tts.Communicate(text, VOICE, rate=rate, boundary="WordBoundary")
    with open(path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7
                words.append([round(start, 3), round(start + chunk["duration"] / 1e7, 3), chunk["text"]])
    return words


async def main():
    plan = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    rate = plan["style"].get("voiceRate", "+8%")
    result = []
    for i, scene in enumerate(plan["scenes"]):
        text = (scene.get("say") or "").strip()
        if not text:
            result.append({"file": None, "words": []})
            continue
        name = f"scene-{i}.mp3"
        for attempt in range(3):
            try:
                words = await synth(text, rate, f"{out}/{name}")
                break
            except Exception as error:  # jaringan ke layanan TTS kadang putus
                if attempt == 2:
                    raise
                print(f"TTS scene {i} gagal ({error}), coba lagi…", file=sys.stderr)
                await asyncio.sleep(3)
        result.append({"file": name, "words": words})
    json.dump(result, open(f"{out}/voice.json", "w"), ensure_ascii=False)


asyncio.run(main())
