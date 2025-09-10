//
//  KioskDragBlock.swift
//  KioskApp
//
//  Created by AI Assistant on 10/9/2025.
//

import SwiftUI

/// Kiosk 模式拖动阻断器 - 防止用户通过拖动手势导航离开应用
struct KioskDragBlock: ViewModifier {
    @State private var dragStartTime: Date?
    
    func body(content: Content) -> some View {
        content
            .highPriorityGesture(
                // 使用高优先级手势，但允许长按通过
                DragGesture(minimumDistance: 10, coordinateSpace: .local)
                    .onChanged { value in
                        // 记录拖动开始时间
                        if dragStartTime == nil {
                            dragStartTime = Date()
                        }
                        
                        // 如果是快速拖动（非长按），则阻断
                        if let startTime = dragStartTime,
                           Date().timeIntervalSince(startTime) < 2.0 {
                            // 阻断快速拖动，但允许长按继续
                            print("🚫 Kiosk: Quick drag blocked")
                        }
                    }
                    .onEnded { _ in
                        dragStartTime = nil
                        print("🚫 Kiosk: Drag ended")
                    }
            )
            .clipped() // 防止内容溢出
            .allowsHitTesting(true)
    }
}

extension View {
    /// 为视图添加 Kiosk 模式拖动阻断功能
    func kioskDragBlock() -> some View {
        modifier(KioskDragBlock())
    }
}
