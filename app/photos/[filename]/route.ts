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
        const slugStem = stem.toLowerCase().trim().replace(/\s+/g, "-");
        const slugFileName = `${slugStem}${ext.toLowerCase()}`;
        
        fs.copyFileSync(srcPath, path.join(publicPhotosDir, slugFileName));
        fs.copyFileSync(srcPath, path.join(publicUpperPhotosDir, slugFileName));

        if (ext.toLowerCase() === ".jpg" || ext.toLowerCase() === ".jpeg") {
          fs.copyFileSync(srcPath, path.join(publicPhotosDir, `${slugStem}.png`));
          fs.copyFileSync(srcPath, path.join(publicUpperPhotosDir, `${slugStem}.png`));
        } else if (ext.toLowerCase() === ".png") {
          fs.copyFileSync(srcPath, path.join(publicPhotosDir, `${slugStem}.jpg`));
          fs.copyFileSync(srcPath, path.join(publicUpperPhotosDir, `${slugStem}.jpg`));
          fs.copyFileSync(srcPath, path.join(publicPhotosDir, `${slugStem}.jpeg`));
          fs.copyFileSync(srcPath, path.join(publicUpperPhotosDir, `${slugStem}.jpeg`));
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
