import AVFoundation
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let src = URL(fileURLWithPath: CommandLine.arguments[1])
let outDir = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let frameCount = Int(CommandLine.arguments[3]) ?? 100
try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

let asset = AVURLAsset(url: src)
let duration = CMTimeGetSeconds(asset.duration)
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
gen.maximumSize = CGSize(width: 720, height: 1280)

func keyed(_ image: CGImage) -> CGImage {
    let w = image.width
    let h = image.height
    let cs = CGColorSpaceCreateDeviceRGB()
    let info = CGImageAlphaInfo.premultipliedLast.rawValue
    guard let ctx = CGContext(
        data: nil,
        width: w,
        height: h,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: cs,
        bitmapInfo: info
    ) else {
        fatalError("context")
    }
    ctx.interpolationQuality = .high
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
    guard let raw = ctx.data else { fatalError("pixels") }
    let ptr = raw.bindMemory(to: UInt8.self, capacity: w * h * 4)
    let bpr = ctx.bytesPerRow

    func delta(_ o: Int) -> Int {
        max(abs(Int(ptr[o]) - 247), abs(Int(ptr[o + 1]) - 248), abs(Int(ptr[o + 2]) - 248))
    }

    var bg = [UInt8](repeating: 0, count: w * h)
    var queue = [Int]()
    queue.reserveCapacity(w * 2)

    func consider(_ x: Int, _ y: Int) {
        let i = y * w + x
        if bg[i] != 0 { return }
        if delta(y * bpr + x * 4) <= 4 {
            bg[i] = 1
            queue.append(i)
        }
    }

    for x in 0..<w {
        consider(x, 0)
        consider(x, h - 1)
    }
    for y in 0..<h {
        consider(0, y)
        consider(w - 1, y)
    }

    var head = 0
    while head < queue.count {
        let i = queue[head]
        head += 1
        let x = i % w
        let y = i / w
        if x > 0 { consider(x - 1, y) }
        if x + 1 < w { consider(x + 1, y) }
        if y > 0 { consider(x, y - 1) }
        if y + 1 < h { consider(x, y + 1) }
    }

    for y in 0..<h {
        let row = y * bpr
        for x in 0..<w {
            let i = y * w + x
            let o = row + x * 4
            if bg[i] == 1 {
                ptr[o] = 0
                ptr[o + 1] = 0
                ptr[o + 2] = 0
                ptr[o + 3] = 0
                continue
            }
            let touch = (x > 0 && bg[i - 1] == 1)
                || (x + 1 < w && bg[i + 1] == 1)
                || (y > 0 && bg[i - w] == 1)
                || (y + 1 < h && bg[i + w] == 1)
            if !touch { continue }
            let d = delta(o)
            if d <= 14 {
                let a = max(0, min(255, (d - 4) * 255 / 10))
                let scale = Float(a) / 255
                ptr[o] = UInt8(Float(ptr[o]) * scale)
                ptr[o + 1] = UInt8(Float(ptr[o + 1]) * scale)
                ptr[o + 2] = UInt8(Float(ptr[o + 2]) * scale)
                ptr[o + 3] = UInt8(a)
            }
        }
    }

    guard let out = ctx.makeImage() else { fatalError("image") }
    return out
}

func writeJPEG(_ image: CGImage, to url: URL) {
    let w = image.width
    let h = image.height
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
        data: nil,
        width: w,
        height: h,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: cs,
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else {
        fatalError("flatten")
    }
    ctx.setFillColor(CGColor(red: 10 / 255, green: 10 / 255, blue: 10 / 255, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
    guard let flat = ctx.makeImage() else { fatalError("flat") }
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
        fatalError("jpeg dest")
    }
    CGImageDestinationAddImage(dest, flat, [kCGImageDestinationLossyCompressionQuality: 0.84] as CFDictionary)
    guard CGImageDestinationFinalize(dest) else { fatalError("jpeg write") }
}

let last = max(frameCount - 1, 1)
for index in 0..<frameCount {
    let seconds = duration * Double(index) / Double(last)
    let time = CMTime(seconds: min(seconds, max(duration - 0.001, 0)), preferredTimescale: 600)
    let cg = try gen.copyCGImage(at: time, actualTime: nil)
    let name = String(format: "f%03d.jpg", index)
    let url = outDir.appendingPathComponent(name)
    writeJPEG(keyed(cg), to: url)
    if index % 10 == 0 || index == frameCount - 1 {
        let bytes = (try? Data(contentsOf: url).count) ?? 0
        print("\(name) \(cg.width)x\(cg.height) \(bytes)")
        fflush(stdout)
    }
}

let manifest = """
{"count":\(frameCount),"width":720,"height":1280}
"""
try manifest.write(to: outDir.appendingPathComponent("manifest.json"), atomically: true, encoding: .utf8)
print("done \(frameCount)")
