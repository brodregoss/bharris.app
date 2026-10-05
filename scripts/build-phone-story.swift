import AppKit
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let outDir = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let baseURL = URL(fileURLWithPath: CommandLine.arguments[2])
let frameCount = 48

guard let baseNS = NSImage(contentsOf: baseURL) else { fatalError("missing base frame") }
var baseRect = NSRect(origin: .zero, size: baseNS.size)
guard let baseCG = baseNS.cgImage(forProposedRect: &baseRect, context: nil, hints: nil) else { fatalError("base cg") }

let screen = CGRect(x: 146, y: 168, width: 440, height: 960)
let sw = Int(screen.width)
let sh = Int(screen.height)

func font(_ size: CGFloat, _ weight: NSFont.Weight) -> NSFont {
    NSFont.systemFont(ofSize: size, weight: weight)
}

func drawText(_ text: String, in rect: CGRect, size: CGFloat, weight: NSFont.Weight, color: NSColor, align: NSTextAlignment, ctx: CGContext) {
    let style = NSMutableParagraphStyle()
    style.alignment = align
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font(size, weight),
        .foregroundColor: color,
        .paragraphStyle: style,
    ]
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: true)
    (text as NSString).draw(in: rect, withAttributes: attrs)
    NSGraphicsContext.restoreGraphicsState()
}

func fillRound(_ ctx: CGContext, _ rect: CGRect, _ radius: CGFloat, _ color: NSColor) {
    ctx.setFillColor(color.cgColor)
    let path = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
    ctx.addPath(path)
    ctx.fillPath()
}

func drawHome(_ ctx: CGContext, press: CGFloat, finger: CGFloat?) {
    ctx.setFillColor(NSColor.white.cgColor)
    ctx.fill(CGRect(x: 0, y: 0, width: sw, height: sh))

    let island = CGRect(x: CGFloat(sw) / 2 - 58, y: 18, width: 116, height: 34)
    fillRound(ctx, island, 17, .black)

    drawText("8:10", in: CGRect(x: 28, y: 22, width: 80, height: 28), size: 16, weight: .semibold, color: .black, align: .left, ctx: ctx)
    drawText("5G", in: CGRect(x: CGFloat(sw) - 118, y: 22, width: 40, height: 28), size: 13, weight: .semibold, color: .black, align: .right, ctx: ctx)
    fillRound(ctx, CGRect(x: CGFloat(sw) - 68, y: 28, width: 26, height: 13), 3, NSColor(white: 0.15, alpha: 1))

    let icon = CGRect(x: CGFloat(sw) / 2 - 28, y: 250, width: 56, height: 56)
    fillRound(ctx, icon, 16, .black)
    ctx.setStrokeColor(NSColor.white.cgColor)
    ctx.setLineWidth(2.4)
    ctx.strokeEllipse(in: icon.insetBy(dx: 16, dy: 16))
    ctx.move(to: CGPoint(x: icon.midX, y: icon.midY))
    ctx.addLine(to: CGPoint(x: icon.midX, y: icon.minY + 18))
    ctx.strokePath()

    drawText("Good Evening, Harris", in: CGRect(x: 24, y: 328, width: CGFloat(sw) - 48, height: 44), size: 28, weight: .bold, color: .black, align: .center, ctx: ctx)
    drawText("Ready when you are.", in: CGRect(x: 24, y: 376, width: CGFloat(sw) - 48, height: 28), size: 16, weight: .regular, color: NSColor(white: 0.45, alpha: 1), align: .center, ctx: ctx)

    let button = CGRect(x: 28, y: 620, width: CGFloat(sw) - 56, height: 58)
    let pressed = button.insetBy(dx: press * 3, dy: press * 2).offsetBy(dx: 0, dy: press * 1)
    let shade = 0.08 + press * 0.12
    fillRound(ctx, pressed, 18, NSColor(white: shade, alpha: 1))
    drawText("Next sitting ready", in: pressed.insetBy(dx: 12, dy: 14), size: 17, weight: .semibold, color: .white, align: .center, ctx: ctx)

    fillRound(ctx, CGRect(x: 28, y: 696, width: CGFloat(sw) - 56, height: 64), 16, NSColor(white: 0.94, alpha: 1))
    drawText("Practice", in: CGRect(x: 28, y: 714, width: CGFloat(sw) - 56, height: 30), size: 16, weight: .medium, color: NSColor(white: 0.25, alpha: 1), align: .center, ctx: ctx)

    let half = (CGFloat(sw) - 56 - 12) / 2
    fillRound(ctx, CGRect(x: 28, y: 774, width: half, height: 72), 16, NSColor(white: 0.94, alpha: 1))
    fillRound(ctx, CGRect(x: 40 + half, y: 774, width: half, height: 72), 16, NSColor(white: 0.94, alpha: 1))
    drawText("Start new cram", in: CGRect(x: 36, y: 798, width: half - 16, height: 28), size: 14, weight: .medium, color: NSColor(white: 0.28, alpha: 1), align: .center, ctx: ctx)
    drawText("Panic notes", in: CGRect(x: 48 + half, y: 798, width: half - 16, height: 28), size: 14, weight: .medium, color: NSColor(white: 0.28, alpha: 1), align: .center, ctx: ctx)

    if let finger {
        let target = CGPoint(x: pressed.midX, y: pressed.midY + 8)
        let start = CGPoint(x: CGFloat(sw) * 0.78, y: 900)
        let p = CGPoint(x: start.x + (target.x - start.x) * finger, y: start.y + (target.y - start.y) * finger)
        let radius: CGFloat = 22 - press * 4
        ctx.setFillColor(NSColor(calibratedRed: 0.96, green: 0.78, blue: 0.66, alpha: 0.95).cgColor)
        ctx.fillEllipse(in: CGRect(x: p.x - radius, y: p.y - radius, width: radius * 2, height: radius * 2))
        ctx.setStrokeColor(NSColor(white: 0, alpha: 0.18).cgColor)
        ctx.setLineWidth(1)
        ctx.strokeEllipse(in: CGRect(x: p.x - radius, y: p.y - radius, width: radius * 2, height: radius * 2))
    }
}

func drawCard(_ ctx: CGContext, flip: CGFloat, showBack: Bool) {
    ctx.setFillColor(NSColor.white.cgColor)
    ctx.fill(CGRect(x: 0, y: 0, width: sw, height: sh))
    let island = CGRect(x: CGFloat(sw) / 2 - 58, y: 18, width: 116, height: 34)
    fillRound(ctx, island, 17, .black)
    drawText("8:10", in: CGRect(x: 28, y: 22, width: 80, height: 28), size: 16, weight: .semibold, color: .black, align: .left, ctx: ctx)

    drawText("Psych", in: CGRect(x: 28, y: 150, width: CGFloat(sw) - 56, height: 24), size: 13, weight: .semibold, color: NSColor(white: 0.45, alpha: 1), align: .center, ctx: ctx)

    let card = CGRect(x: 28, y: 200, width: CGFloat(sw) - 56, height: 520)
    ctx.saveGState()
    ctx.translateBy(x: card.midX, y: card.midY)
    let scale = max(0.04, abs(cos(flip * .pi)))
    ctx.scaleBy(x: scale, y: 1)
    let local = CGRect(x: -card.width / 2, y: -card.height / 2, width: card.width, height: card.height)
    fillRound(ctx, local, 28, NSColor(white: 0.96, alpha: 1))
    if showBack {
        drawText("Definition", in: local.insetBy(dx: 28, dy: 0).offsetBy(dx: 0, dy: 150), size: 14, weight: .semibold, color: NSColor(white: 0.45, alpha: 1), align: .center, ctx: ctx)
        drawText("The part of the brain\nthat forms new memories.", in: local.insetBy(dx: 32, dy: 0).offsetBy(dx: 0, dy: 190), size: 26, weight: .bold, color: .black, align: .center, ctx: ctx)
    } else {
        drawText("Term", in: local.insetBy(dx: 28, dy: 0).offsetBy(dx: 0, dy: 150), size: 14, weight: .semibold, color: NSColor(white: 0.45, alpha: 1), align: .center, ctx: ctx)
        drawText("Hippocampus", in: local.insetBy(dx: 20, dy: 0).offsetBy(dx: 0, dy: 190), size: 32, weight: .bold, color: .black, align: .center, ctx: ctx)
        drawText("Tap to flip", in: local.insetBy(dx: 20, dy: 0).offsetBy(dx: 0, dy: 250), size: 15, weight: .regular, color: NSColor(white: 0.45, alpha: 1), align: .center, ctx: ctx)
    }
    ctx.restoreGState()
}

func screenImage(for index: Int) -> CGImage {
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
        data: nil, width: sw, height: sh, bitsPerComponent: 8, bytesPerRow: 0,
        space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { fatalError("screen") }
    ctx.translateBy(x: 0, y: CGFloat(sh))
    ctx.scaleBy(x: 1, y: -1)
    ctx.setAllowsAntialiasing(true)
    ctx.interpolationQuality = .high

    if index < 21 {
        let finger: CGFloat? = index < 8 ? nil : min(1, CGFloat(index - 8) / 7)
        let press: CGFloat = index < 16 ? 0 : min(1, CGFloat(index - 16) / 4)
        drawHome(ctx, press: press, finger: finger)
    } else if index < 28 {
        let t = CGFloat(index - 21) / 6
        drawHome(ctx, press: 1, finger: nil)
        ctx.saveGState()
        let top = CGFloat(sh) * (1 - t)
        ctx.clip(to: CGRect(x: 0, y: top, width: CGFloat(sw), height: CGFloat(sh) - top))
        drawCard(ctx, flip: 0, showBack: false)
        ctx.restoreGState()
    } else if index < 34 {
        drawCard(ctx, flip: 0, showBack: false)
    } else if index < 45 {
        let t = CGFloat(index - 34) / 10
        drawCard(ctx, flip: t, showBack: t > 0.5)
    } else {
        drawCard(ctx, flip: 1, showBack: true)
    }

    guard let image = ctx.makeImage() else { fatalError("screen image") }
    return image
}

func writeFrame(_ index: Int) {
    let w = baseCG.width
    let h = baseCG.height
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
        data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
        space: cs, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else { fatalError("frame") }
    ctx.draw(baseCG, in: CGRect(x: 0, y: 0, width: w, height: h))
    ctx.saveGState()
    let clip = CGPath(roundedRect: screen.insetBy(dx: 2, dy: 2), cornerWidth: 42, cornerHeight: 42, transform: nil)
    ctx.addPath(clip)
    ctx.clip()
    ctx.draw(screenImage(for: index), in: screen)
    ctx.restoreGState()
    guard let flat = ctx.makeImage() else { fatalError("flat") }
    let url = outDir.appendingPathComponent(String(format: "f%03d.jpg", index))
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { fatalError("dest") }
    CGImageDestinationAddImage(dest, flat, [kCGImageDestinationLossyCompressionQuality: 0.86] as CFDictionary)
    guard CGImageDestinationFinalize(dest) else { fatalError("write") }
}

for i in 0..<frameCount {
    writeFrame(i)
}
let manifest = "{\"count\":\(frameCount),\"width\":720,\"height\":1280}\n"
try manifest.write(to: outDir.appendingPathComponent("manifest.json"), atomically: true, encoding: .utf8)
print("wrote \(frameCount)")
