// Renders the Liquid Glass app icon. Run: swift macos/icon.swift  (writes glass_1024.png + glass_preview.png)
import AppKit
import CoreImage

// Liquid Glass style icon: dark green ground, a frosted glass terminal plate, and a tinted glass bookmark in front.
let S = 1024
let W = CGFloat(S)
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
func ctxNew() -> CGContext {
  CGContext(data: nil, width: S, height: S, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
}
func rgba(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1) -> CGColor { CGColor(colorSpace: cs, components: [r, g, b, a])! }
func squircle(_ r: CGRect, _ k: CGFloat) -> CGPath {
  // continuous-corner approximation (superellipse-ish) using a rounded rect with generous radius
  CGPath(roundedRect: r, cornerWidth: r.width * k, cornerHeight: r.height * k, transform: nil)
}
func lin(_ c: CGContext, _ colors: [CGColor], _ locs: [CGFloat], _ a: CGPoint, _ b: CGPoint) {
  let g = CGGradient(colorsSpace: cs, colors: colors as CFArray, locations: locs)!
  c.drawLinearGradient(g, start: a, end: b, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
}
func rad(_ c: CGContext, _ colors: [CGColor], _ locs: [CGFloat], _ p: CGPoint, _ r: CGFloat) {
  let g = CGGradient(colorsSpace: cs, colors: colors as CFArray, locations: locs)!
  c.drawRadialGradient(g, startCenter: p, startRadius: 0, endCenter: p, endRadius: r, options: [.drawsBeforeStartLocation])
}
func blurred(_ img: CGImage, _ radius: Double) -> CGImage {
  let ci = CIImage(cgImage: img).clampedToExtent().applyingGaussianBlur(sigma: radius).cropped(to: CGRect(x: 0, y: 0, width: S, height: S))
  return CIContext().createCGImage(ci, from: CGRect(x: 0, y: 0, width: S, height: S))!
}

let tile = CGRect(x: 0, y: 0, width: W, height: W).insetBy(dx: 52, dy: 52)
let tilePath = squircle(tile, 0.225)

// ---------- 1. background ground ----------
let bgc = ctxNew()
bgc.addPath(tilePath); bgc.clip()
lin(bgc, [rgba(0.02, 0.16, 0.08), rgba(0.0, 0.035, 0.02)], [0, 1], CGPoint(x: 0, y: W), CGPoint(x: W, y: 0))
rad(bgc, [rgba(0.0, 0.95, 0.42, 0.55), rgba(0.0, 0.6, 0.25, 0.0)], [0, 1], CGPoint(x: W * 0.30, y: W * 0.70), W * 0.55)
rad(bgc, [rgba(0.15, 0.35, 1.0, 0.35), rgba(0.1, 0.2, 0.9, 0.0)], [0, 1], CGPoint(x: W * 0.85, y: W * 0.15), W * 0.5)
// faint scanlines for the terminal feel
bgc.setFillColor(rgba(0, 0, 0, 0.18))
var y: CGFloat = 0
while y < W { bgc.fill(CGRect(x: 0, y: y, width: W, height: 3)); y += 9 }
let bg = bgc.makeImage()!
let bgBlur = blurred(bg, 26)

// ---------- final canvas ----------
let c = ctxNew()
// outer soft shadow of the whole tile
c.saveGState()
c.setShadow(offset: CGSize(width: 0, height: -14), blur: 40, color: rgba(0, 0, 0, 0.45))
c.addPath(tilePath); c.setFillColor(rgba(0, 0, 0, 1)); c.fillPath()
c.restoreGState()
c.saveGState(); c.addPath(tilePath); c.clip(); c.draw(bg, in: CGRect(x: 0, y: 0, width: W, height: W)); c.restoreGState()

// glass helper: frosted backdrop + tint + rim light + specular sheen
func glass(_ path: CGPath, tint: CGColor, tintTop: CGColor, rimAlpha: CGFloat, shadow: CGFloat, backdrop: CGImage? = nil) {
  let box = path.boundingBox
  // drop shadow under the glass
  c.saveGState()
  c.setShadow(offset: CGSize(width: 0, height: -18), blur: 36, color: rgba(0, 0, 0, shadow))
  c.addPath(path); c.setFillColor(rgba(0, 0, 0, 0.35)); c.fillPath()
  c.restoreGState()
  // frosted backdrop (blurred ground shows through)
  c.saveGState(); c.addPath(path); c.clip()
  c.draw(backdrop ?? bgBlur, in: CGRect(x: 0, y: 0, width: W, height: W))
  lin(c, [tintTop, tint], [0, 1], CGPoint(x: box.midX, y: box.maxY), CGPoint(x: box.midX, y: box.minY))
  // specular sheen across the upper part
  lin(c, [rgba(1, 1, 1, 0.30), rgba(1, 1, 1, 0.06), rgba(1, 1, 1, 0.0)], [0, 0.35, 0.6], CGPoint(x: box.minX, y: box.maxY), CGPoint(x: box.midX, y: box.minY))
  c.restoreGState()
  // rim light: bright top-left edge fading to the bottom
  c.saveGState()
  c.addPath(path); c.setLineWidth(5); c.replacePathWithStrokedPath(); c.clip()
  lin(c, [rgba(1, 1, 1, rimAlpha), rgba(1, 1, 1, 0.10), rgba(1, 1, 1, rimAlpha * 0.5)], [0, 0.55, 1], CGPoint(x: box.minX, y: box.maxY), CGPoint(x: box.maxX, y: box.minY))
  c.restoreGState()
}

// ---------- 2. terminal plate (back glass layer) ----------
let plate = CGRect(x: 170, y: 250, width: 560, height: 470)
let platePath = CGPath(roundedRect: plate, cornerWidth: 70, cornerHeight: 70, transform: nil)
glass(platePath, tint: rgba(0.0, 0.10, 0.05, 0.55), tintTop: rgba(0.55, 1.0, 0.75, 0.16), rimAlpha: 0.85, shadow: 0.45)
// window dots
for (i, col) in [rgba(1, 0.33, 0.33, 0.9), rgba(1, 0.78, 0.2, 0.9), rgba(0.2, 0.95, 0.5, 0.9)].enumerated() {
  c.setFillColor(col); c.fillEllipse(in: CGRect(x: plate.minX + 48 + CGFloat(i) * 44, y: plate.maxY - 72, width: 26, height: 26))
}
// glowing prompt text
func glowText(_ s: String, at p: CGPoint, size: CGFloat, color: NSColor, glow: CGFloat) {
  let g = NSGraphicsContext(cgContext: c, flipped: false)
  NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = g
  c.saveGState()
  c.setShadow(offset: .zero, blur: glow, color: color.withAlphaComponent(0.9).cgColor)
  let f = NSFont.monospacedSystemFont(ofSize: size, weight: .bold)
  (s as NSString).draw(at: p, withAttributes: [.font: f, .foregroundColor: color])
  c.restoreGState()
  NSGraphicsContext.restoreGraphicsState()
}
let phosphor = NSColor(srgbRed: 0.35, green: 1.0, blue: 0.60, alpha: 1)
glowText(">_", at: CGPoint(x: plate.minX + 52, y: plate.minY + 205), size: 150, color: phosphor, glow: 30)
// three "bookmark rows" as glowing bars
for i in 0..<3 {
  let w: CGFloat = [300, 220, 260][i]
  let r = CGRect(x: plate.minX + 56, y: plate.minY + 150 - CGFloat(i) * 46, width: w, height: 18)
  c.saveGState(); c.setShadow(offset: .zero, blur: 14, color: rgba(0.2, 1, 0.5, 0.7))
  c.addPath(CGPath(roundedRect: r, cornerWidth: 9, cornerHeight: 9, transform: nil)); c.setFillColor(rgba(0.35, 1, 0.6, [0.85, 0.55, 0.35][i])); c.fillPath()
  c.restoreGState()
}

// ---------- 3. bookmark ribbon (front tinted glass layer) ----------
let rb = CGMutablePath()
let rx: CGFloat = 560, rw: CGFloat = 270, rtop: CGFloat = 820, rbot: CGFloat = 330, notch: CGFloat = 115
rb.move(to: CGPoint(x: rx + 46, y: rtop))
rb.addLine(to: CGPoint(x: rx + rw - 46, y: rtop))
rb.addQuadCurve(to: CGPoint(x: rx + rw, y: rtop - 46), control: CGPoint(x: rx + rw, y: rtop))
rb.addLine(to: CGPoint(x: rx + rw, y: rbot + 20))
rb.addQuadCurve(to: CGPoint(x: rx + rw - 34, y: rbot + 12), control: CGPoint(x: rx + rw, y: rbot - 6))
rb.addLine(to: CGPoint(x: rx + rw / 2 + 14, y: rbot + notch - 6))
rb.addQuadCurve(to: CGPoint(x: rx + rw / 2 - 14, y: rbot + notch - 6), control: CGPoint(x: rx + rw / 2, y: rbot + notch + 6))
rb.addLine(to: CGPoint(x: rx + 34, y: rbot + 12))
rb.addQuadCurve(to: CGPoint(x: rx, y: rbot + 20), control: CGPoint(x: rx, y: rbot - 6))
rb.addLine(to: CGPoint(x: rx, y: rtop - 46))
rb.addQuadCurve(to: CGPoint(x: rx + 46, y: rtop), control: CGPoint(x: rx, y: rtop))
rb.closeSubpath()
let behind = blurred(c.makeImage()!, 14)
glass(rb, tint: rgba(0.0, 0.70, 0.30, 0.34), tintTop: rgba(0.55, 1.0, 0.72, 0.30), rimAlpha: 1.0, shadow: 0.40, backdrop: behind)
// inner refraction glint
c.saveGState(); c.addPath(rb); c.clip()
rad(c, [rgba(1, 1, 1, 0.45), rgba(1, 1, 1, 0)], [0, 1], CGPoint(x: rx + 70, y: rtop - 80), 150)
c.restoreGState()

// ---------- 4. tile-wide glass edge + top sheen ----------
c.saveGState(); c.addPath(tilePath); c.clip()
lin(c, [rgba(1, 1, 1, 0.16), rgba(1, 1, 1, 0.0)], [0, 1], CGPoint(x: W / 2, y: W - 52), CGPoint(x: W / 2, y: W * 0.62))
c.restoreGState()
c.saveGState()
c.addPath(tilePath); c.setLineWidth(6); c.replacePathWithStrokedPath(); c.clip()
lin(c, [rgba(1, 1, 1, 0.55), rgba(1, 1, 1, 0.05), rgba(1, 1, 1, 0.25)], [0, 0.5, 1], CGPoint(x: 0, y: W), CGPoint(x: W, y: 0))
c.restoreGState()

let out = c.makeImage()!
let rep = NSBitmapImageRep(cgImage: out)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "glass_1024.png"))

// ---------- preview sheet: big icon + sizes on dark and light ----------
let PW = 1600, PH = 1100
let p = CGContext(data: nil, width: PW, height: PH, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
p.setFillColor(rgba(0.06, 0.06, 0.07)); p.fill(CGRect(x: 0, y: 0, width: PW, height: PH))
p.setFillColor(rgba(0.93, 0.93, 0.95)); p.fill(CGRect(x: 1100, y: 0, width: 500, height: PH))
p.interpolationQuality = .high
p.draw(out, in: CGRect(x: 40, y: 40, width: 1020, height: 1020))
var yy: CGFloat = 820
for s in [256, 128, 64, 32] {
  let sz = CGFloat(s)
  p.draw(out, in: CGRect(x: 1350 - sz / 2, y: yy - sz / 2 + 60, width: sz, height: sz))
  yy -= sz + 70
}
let prep = NSBitmapImageRep(cgImage: p.makeImage()!)
try! prep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "glass_preview.png"))
