import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return "image/jpeg";
}

function syncPhotosToPublic() {
  try {
    const photosDir = path.join(process.cwd(), "Photos");
    const publicPhotosDir = path.join(process.cwd(), "public", "photos");
    const publicUpperPhotosDir = path.join(process.cwd(), "public", "Photos");

    if (!fs.existsSync(photosDir)) return;

    if (!fs.existsSync(publicPhotosDir)) {
      fs.mkdirSync(publicPhotosDir, { recursive: true });
    }
    if (!fs.existsSync(publicUpperPhotosDir)) {
      fs.mkdirSync(publicUpperPhotosDir, { recursive: true });
    }

    const files = fs.readdirSync(photosDir);
    for (const file of files) {
      const srcPath = path.join(photosDir, file);
      if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, path.join(publicPhotosDir, file));
        fs.copyFileSync(srcPath, path.join(publicUpperPhotosDir, file));

        const ext = path.extname(file);
        const stem = file.replace(/\.[^/.]+$/, "");
        const slugHyphen = stem.toLowerCase().trim().replace(/[\s_]+/g, "-");
        const slugUnderscore = stem.toLowerCase().trim().replace(/[\s-]+/g, "_");
        const cleanStem = stem.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
        
        const exts = [".jpg", ".jpeg", ".png", ".webp"];
        for (const targetExt of exts) {
          try {
            fs.copyFileSync(srcPath, path.join(publicPhotosDir, `${slugHyphen}${targetExt}`));
            fs.copyFileSync(srcPath, path.join(publicUpperPhotosDir, `${slugHyphen}${targetExt}`));
            fs.copyFileSync(srcPath, path.join(publicPhotosDir, `${slugUnderscore}${targetExt}`));
            fs.copyFileSync(srcPath, path.join(publicUpperPhotosDir, `${slugUnderscore}${targetExt}`));
            fs.copyFileSync(srcPath, path.join(publicPhotosDir, `${cleanStem}${targetExt}`));
            fs.copyFileSync(srcPath, path.join(publicUpperPhotosDir, `${cleanStem}${targetExt}`));
          } catch {
            // ignore individual copy errors
          }
        }
      }
    }
  } catch (err) {
    console.error("Error syncing photos to public:", err);
  }
}

syncPhotosToPublic();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    syncPhotosToPublic();

    const { filename } = await params;
    const decoded = decodeURIComponent(filename);

    const photosDir = path.join(process.cwd(), "Photos");
    if (!fs.existsSync(photosDir)) {
      return new NextResponse("Photos directory not found", { status: 404 });
    }

    const exactPath = path.join(photosDir, decoded);
    if (fs.existsSync(exactPath) && fs.statSync(exactPath).isFile()) {
      const fileBuffer = fs.readFileSync(exactPath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": getContentType(exactPath),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const files = fs.readdirSync(photosDir);
    const targetStem = normalizeName(decoded.replace(/\.[^/.]+$/, ""));

    const matchedFile = files.find((f) => {
      const fileStem = normalizeName(f.replace(/\.[^/.]+$/, ""));
      return fileStem === targetStem;
    });

    if (matchedFile) {
      const filePath = path.join(photosDir, matchedFile);
      const fileBuffer = fs.readFileSync(filePath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": getContentType(filePath),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new NextResponse("Photo not found", { status: 404 });
  } catch {
    return new NextResponse("Error reading photo", { status: 500 });
  }
}
