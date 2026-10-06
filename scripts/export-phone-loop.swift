import AVFoundation
import CoreGraphics
import CoreVideo
import Foundation

let src = URL(fileURLWithPath: CommandLine.arguments[1])
let outURL = URL(fileURLWithPath: CommandLine.arguments[2])
let fps: Int32 = 30

try? FileManager.default.removeItem(at: outURL)
try FileManager.default.createDirectory(at: outURL.deletingLastPathComponent(), withIntermediateDirectories: true)

let asset = AVURLAsset(url: src)
let duration = CMTimeGetSeconds(asset.duration)
let frameCount = max(Int((duration * Double(fps)).rounded(.down)), 2)

let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
gen.maximumSize = CGSize(width: 1080, height: 1920)

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
        max(abs(Int(ptr[o]) - 248), abs(Int(ptr[o + 1]) - 248), abs(Int(ptr[o + 2]) - 249))
    }

    var bg = [UInt8](repeating: 0, count: w * h)
    var queue = [Int]()
    queue.reserveCapacity(w * 2)

    func consider(_ x: Int, _ y: Int) {
        let i = y * w + x
        if bg[i] != 0 { return }
        if delta(y * bpr + x * 4) <= 3 {
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

    var dist = [UInt8](repeating: 255, count: w * h)
    var edge = [Int]()
    edge.reserveCapacity(w)
    for y in 0..<h {
        for x in 0..<w {
            let i = y * w + x
            if bg[i] != 1 { continue }
            let onEdge = (x > 0 && bg[i - 1] == 0)
                || (x + 1 < w && bg[i + 1] == 0)
                || (y > 0 && bg[i - w] == 0)
                || (y + 1 < h && bg[i + w] == 0)
            if onEdge {
                dist[i] = 0
                edge.append(i)
            }
        }
    }
    var cursor = 0
    while cursor < edge.count {
        let i = edge[cursor]
        cursor += 1
        let d = dist[i]
        if d >= 3 { continue }
        let x = i % w
        let y = i / w
        let next = d &+ 1
        func visit(_ j: Int) {
            if dist[j] <= next { return }
            dist[j] = next
            edge.append(j)
        }
        if x > 0 { visit(i - 1) }
        if x + 1 < w { visit(i + 1) }
        if y > 0 { visit(i - w) }
        if y + 1 < h { visit(i + w) }
    }

    let srcBytes = Array(UnsafeBufferPointer(start: ptr, count: bpr * h))
    let page: Float = 10
    for y in 0..<h {
        let row = y * bpr
        for x in 0..<w {
            let i = y * w + x
            let o = row + x * 4
            let d = dist[i]
            if d == 0 || bg[i] == 1 {
                ptr[o] = 10
                ptr[o + 1] = 10
                ptr[o + 2] = 10
                ptr[o + 3] = 255
                continue
            }
            if d > 3 { continue }
            var sr: Float = 0
            var sg: Float = 0
            var sb: Float = 0
            var weight: Float = 0
            for oy in -2...2 {
                let yy = y + oy
                if yy < 0 || yy >= h { continue }
                for ox in -2...2 {
                    let xx = x + ox
                    if xx < 0 || xx >= w { continue }
                    let j = yy * w + xx
                    let fall = Float(4 - (abs(ox) + abs(oy)))
                    if fall <= 0 { continue }
                    if dist[j] == 0 || bg[j] == 1 {
                        sr += page * fall
                        sg += page * fall
                        sb += page * fall
                    } else {
                        let p = yy * bpr + xx * 4
                        sr += Float(srcBytes[p]) * fall
                        sg += Float(srcBytes[p + 1]) * fall
                        sb += Float(srcBytes[p + 2]) * fall
                    }
                    weight += fall
                }
            }
            let keep: Float = d == 1 ? 0.42 : (d == 2 ? 0.78 : 0.94)
            let rr = sr / weight
            let gg = sg / weight
            let bb = sb / weight
            ptr[o] = UInt8(rr * keep + page * (1 - keep))
            ptr[o + 1] = UInt8(gg * keep + page * (1 - keep))
            ptr[o + 2] = UInt8(bb * keep + page * (1 - keep))
            ptr[o + 3] = 255
        }
    }

    guard let out = ctx.makeImage() else { fatalError("image") }
    return out
}

let probe = try gen.copyCGImage(at: .zero, actualTime: nil)
let width = probe.width
let height = probe.height
print("frames \(frameCount) \(width)x\(height)")
fflush(stdout)

let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 10_000_000,
        AVVideoExpectedSourceFrameRateKey: fps,
        AVVideoMaxKeyFrameIntervalKey: fps,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    ],
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let attrs: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
]
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: attrs)
writer.add(input)
guard writer.startWriting() else { fatalError("start \(String(describing: writer.error))") }
writer.startSession(atSourceTime: .zero)

func pixelBuffer(from image: CGImage) -> CVPixelBuffer {
    var buffer: CVPixelBuffer?
    let status = CVPixelBufferCreate(
        kCFAllocatorDefault,
        width,
        height,
        kCVPixelFormatType_32BGRA,
        attrs as CFDictionary,
        &buffer
    )
    guard status == kCVReturnSuccess, let buffer else { fatalError("pixel buffer \(status)") }
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let ctx = CGContext(
        data: CVPixelBufferGetBaseAddress(buffer),
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    ) else {
        fatalError("pixel context")
    }
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return buffer
}

let frameDuration = CMTime(value: 1, timescale: fps)
for index in 0..<frameCount {
    let seconds = min(Double(index) / Double(fps), max(duration - 0.001, 0))
    let time = CMTime(seconds: seconds, preferredTimescale: 600)
    let cg = try gen.copyCGImage(at: time, actualTime: nil)
    let buffer = pixelBuffer(from: keyed(cg))
    while !input.isReadyForMoreMediaData {
        Thread.sleep(forTimeInterval: 0.005)
    }
    let pts = CMTimeMultiply(frameDuration, multiplier: Int32(index))
    if !adaptor.append(buffer, withPresentationTime: pts) {
        fatalError("append \(index) \(String(describing: writer.error))")
    }
    if index % 30 == 0 || index == frameCount - 1 {
        print("frame \(index)")
        fflush(stdout)
    }
}

input.markAsFinished()
let group = DispatchGroup()
group.enter()
writer.finishWriting { group.leave() }
group.wait()
if writer.status != .completed {
    fatalError("finish \(String(describing: writer.error))")
}
let bytes = (try? Data(contentsOf: outURL).count) ?? 0
print("done \(bytes)")
