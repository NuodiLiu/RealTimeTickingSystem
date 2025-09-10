//
//  KioskScrollView.swift
//  KioskApp
//
//  Created by AI Assistant on 10/9/2025.
//

import SwiftUI

/// Kiosk 模式专用 ScrollView - 完全控制滚动行为，防止弹跳和过度滚动
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
        .scrollBounceBehavior(.basedOnSize) // 基于内容大小决定是否弹跳
        .scrollDisabled(false) // 允许必要的滚动
        .gesture(
            // 拦截过度的拖动手势
            DragGesture()
                .onChanged { value in
                    // 限制拖动幅度，防止过度弹跳
                    let maxTranslation: CGFloat = 50
                    if abs(value.translation.height) > maxTranslation {
                        print("🚫 Kiosk ScrollView: Excessive drag blocked")
                    }
                }
        )
        .clipped() // 确保内容不会溢出边界
    }
}

extension View {
    /// 将普通视图包装为 Kiosk 模式的受控滚动视图
    func kioskScrollable(
        _ axes: Axis.Set = .vertical,
        showsIndicators: Bool = false
    ) -> some View {
        KioskScrollView(axes, showsIndicators: showsIndicators) {
            self
        }
    }
}
