#!/usr/bin/env swift
import AppKit
import Foundation
import Vision

struct OcrItem: Encodable {
    let text: String
    let confidence: Float
}

struct OcrResult: Encodable {
    let file: String
    let status: String
    let items: [OcrItem]
    let error: String?
}

func recognizeText(path: String) -> OcrResult {
    guard let image = NSImage(contentsOfFile: path),
          let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        return OcrResult(file: path, status: "failed", items: [], error: "Unable to load image")
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["zh-Hant", "en-US"]

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

    do {
        try handler.perform([request])
        let observations = request.results ?? []
        let items = observations.compactMap { observation -> OcrItem? in
            guard let candidate = observation.topCandidates(1).first else {
                return nil
            }
            let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty {
                return nil
            }
            return OcrItem(text: text, confidence: candidate.confidence)
        }
        return OcrResult(file: path, status: "ok", items: items, error: nil)
    } catch {
        return OcrResult(file: path, status: "failed", items: [], error: error.localizedDescription)
    }
}

let paths = Array(CommandLine.arguments.dropFirst())
if paths.isEmpty {
    fputs("Usage: swift scripts/ocr-vision.swift <image-file> [...]\n", stderr)
    exit(1)
}

let results = paths.map { recognizeText(path: $0) }
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

do {
    let data = try encoder.encode(results)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write("\n".data(using: .utf8)!)
} catch {
    fputs("Failed to encode OCR results: \(error.localizedDescription)\n", stderr)
    exit(1)
}
