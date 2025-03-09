const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());
const hostname = process.env.HOST || "0.0.0.0"

// Serve static images from the /uploads folder
app.use("/images", express.static(path.join(__dirname, "images")));

app.post("/generate-image", async (req, res) => {
  try {
    const { html, css, width = 800, height = 600 } = req.body;

    if (!html) return res.status(400).json({ error: "HTML is required" });

    const browser = await puppeteer.launch({
      executablePath: "/usr/bin/chromium", // Use the installed Chrome
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--single-process",
      ],
    });
    const page = await browser.newPage();

    // Inject HTML and CSS into the page
    const content = `<html><head><style>${css || ""}</style></head><body>${html}</body></html>`;
    await page.setContent(content, { waitUntil: "networkidle0" });
    await page.setViewport({ width, height });

    // Find the bounding box of all visible elements
    const boundingBox = await page.evaluate(() => {
      const body = document.body;
      const rect = body.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
    });

    // Generate unique filename
    const filename = `${uuidv4()}.png`;
    const imagePath = path.join(__dirname, "images", filename);

    // Take a cropped screenshot
    await page.screenshot({
      path: imagePath,
      type: "png",
      clip: {
        x: Math.max(0, boundingBox.x),
        y: Math.max(0, boundingBox.y),
        width: Math.min(width, boundingBox.width),
        height: Math.min(height, boundingBox.height),
      },
    });

    await browser.close();

    // Return the public URL of the image
    res.json({ imageUrl: `/images/${filename}` });

  } catch (error) {
    console.error("Error generating image:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 80;
app.listen(PORT, hostname, () => {
  console.log(`Server running on port ${hostname}:${PORT}`);

  // Ensure uploads folder exists
  if (!fs.existsSync(path.join(__dirname, "images"))) {
    fs.mkdirSync(path.join(__dirname, "images"));
  }
});
