//
//  KioskScrollView.swift
//  KioskApp
//

import SwiftUI

struct KioskScrollView<Content: View>: View {
    let axes: Axis.Set
    let showsIndicators: Bool
    let content: Content
    
    init(
        _ axes: Axis.Set = .vertical,
        showsIndicators: Bool = false,
        @ViewBuilder content: () -> Content
    ) {
        self.axes = axes
        self.showsIndicators = showsIndicators
        self.content = content()
    }
    
    var body: some View {
        ScrollView(axes, showsIndicators: showsIndicators) {
            content
        }
        .scrollBounceBehavior(.basedOnSize) 
        .scrollDisabled(false) 
        .gesture(
            DragGesture()
                .onChanged { value in
                    let maxTranslation: CGFloat = 50
                    if abs(value.translation.height) > maxTranslation {
                        print("🚫 Kiosk ScrollView: Excessive drag blocked")
                    }
                }
        )
        .clipped() 
    }
}

extension View {
    func kioskScrollable(
        _ axes: Axis.Set = .vertical,
        showsIndicators: Bool = false
    ) -> some View {
        KioskScrollView(axes, showsIndicators: showsIndicators) {
            self
        }
    }
}
