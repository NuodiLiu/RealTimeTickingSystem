//
//  NoBouncingScrollView.swift
//  KioskApp
//
//  Created by AI Assistant on 10/9/2025.
//

import SwiftUI
import UIKit

/// 完全禁用弹跳的 ScrollView
struct NoBouncingScrollView<Content: View>: UIViewRepresentable {
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
    
    func makeUIView(context: Context) -> UIScrollView {
        let scrollView = UIScrollView()
        
        // 完全禁用弹跳
        scrollView.bounces = false
        scrollView.alwaysBounceVertical = false
        scrollView.alwaysBounceHorizontal = false
        
        // 配置滚动指示器
        scrollView.showsVerticalScrollIndicator = showsIndicators && axes.contains(.vertical)
        scrollView.showsHorizontalScrollIndicator = showsIndicators && axes.contains(.horizontal)
        
        // 配置滚动方向
        if !axes.contains(.vertical) {
            scrollView.isScrollEnabled = false
        }
        
        // 创建 SwiftUI 内容的 hosting controller
        let hostingController = UIHostingController(rootView: content)
        hostingController.view.backgroundColor = UIColor.clear
        
        // 添加内容到滚动视图
        scrollView.addSubview(hostingController.view)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        
        // 设置约束
        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: scrollView.topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            
            // 确保内容宽度与滚动视图一致（如果只是垂直滚动）
            hostingController.view.widthAnchor.constraint(equalTo: scrollView.widthAnchor)
        ])
        
        return scrollView
    }
    
    func updateUIView(_ uiView: UIScrollView, context: Context) {
        // 更新配置
        uiView.bounces = false
        uiView.alwaysBounceVertical = false
        uiView.alwaysBounceHorizontal = false
    }
}
