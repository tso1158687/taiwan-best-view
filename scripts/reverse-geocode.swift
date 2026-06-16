#!/usr/bin/env swift
import CoreLocation
import Foundation

func jsonLine(_ object: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]),
       let text = String(data: data, encoding: .utf8) {
        print(text)
    } else {
        print("{\"status\":\"error\",\"reason\":\"json_encoding_failed\"}")
    }
}

guard CommandLine.arguments.count >= 3,
      let latitude = Double(CommandLine.arguments[1]),
      let longitude = Double(CommandLine.arguments[2]) else {
    jsonLine([
        "status": "error",
        "reason": "usage: reverse-geocode.swift <latitude> <longitude>",
    ])
    exit(0)
}

let geocoder = CLGeocoder()
let location = CLLocation(latitude: latitude, longitude: longitude)
let semaphore = DispatchSemaphore(value: 0)
let lock = NSLock()
var completed = false
var result: [String: Any] = [
    "status": "unavailable",
    "reason": "timeout",
    "latitude": latitude,
    "longitude": longitude,
]

func finish(_ value: [String: Any]) {
    lock.lock()
    defer { lock.unlock() }
    if completed { return }
    completed = true
    result = value
    semaphore.signal()
}

geocoder.reverseGeocodeLocation(location, preferredLocale: Locale(identifier: "zh_TW")) { placemarks, error in
    if let error = error {
        finish([
            "status": "unavailable",
            "reason": error.localizedDescription,
            "latitude": latitude,
            "longitude": longitude,
        ])
        return
    }

    guard let placemark = placemarks?.first else {
        finish([
            "status": "unavailable",
            "reason": "no_placemark",
            "latitude": latitude,
            "longitude": longitude,
        ])
        return
    }

    let addressParts = [
        placemark.administrativeArea,
        placemark.locality,
        placemark.subLocality,
        placemark.thoroughfare,
        placemark.subThoroughfare,
    ].compactMap { $0 }.filter { !$0.isEmpty }

    finish([
        "status": "ok",
        "latitude": latitude,
        "longitude": longitude,
        "name": placemark.name ?? "",
        "administrativeArea": placemark.administrativeArea ?? "",
        "locality": placemark.locality ?? "",
        "subLocality": placemark.subLocality ?? "",
        "thoroughfare": placemark.thoroughfare ?? "",
        "subThoroughfare": placemark.subThoroughfare ?? "",
        "postalCode": placemark.postalCode ?? "",
        "country": placemark.country ?? "",
        "isoCountryCode": placemark.isoCountryCode ?? "",
        "formattedAddress": addressParts.joined(),
    ])
}

DispatchQueue.global().asyncAfter(deadline: .now() + 15) {
    geocoder.cancelGeocode()
    finish([
        "status": "unavailable",
        "reason": "timeout",
        "latitude": latitude,
        "longitude": longitude,
    ])
}

_ = semaphore.wait(timeout: .now() + 16)
jsonLine(result)
