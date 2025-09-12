import SwiftUI

struct InlineDropdown<Item: Identifiable & Hashable>: View {
    let title: String
    let items: [Item]
    @Binding var selection: Item?
    let name: (Item) -> String

    var placeholder: String = "Select"
    var headerHidden: Bool = false
    
    // 允许外部控制展开状态
    @Binding var expanded: Bool

    var body: some View {
        ZStack(alignment: .topLeading) {            
            VStack(spacing: 8) {
                // 头部行（可隐藏，便于做 Google Form 风格）
                if !headerHidden {
                    Button {
                        withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
                            expanded.toggle()
                        }
                    } label: {
                        HStack {
                            Text(title.uppercased())
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }

                // 外观像 Select 框
                Button {
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
                        expanded.toggle()
                    }
                } label: {
                    HStack(spacing: 8) {
                        Text(selection.map(name) ?? placeholder)
                            .foregroundStyle(selection == nil ? .secondary : .primary)
                            .lineLimit(1)
                        Spacer()
                        Image(systemName: "chevron.down")
                            .rotationEffect(.degrees(expanded ? 180 : 0))
                            .animation(.easeInOut(duration: 0.2), value: expanded)
                    }
                    .padding(.vertical, 14)
                    .padding(.horizontal, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(Color(.systemBackground))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(Color(.quaternaryLabel), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
            
            if expanded {
                VStack(spacing: 0) {
                    Rectangle().fill(.clear)
                        .frame(height: headerHidden ? 56 : 80)

                    ScrollView(.vertical, showsIndicators: true) {
                        LazyVStack(spacing: 0) {
                            ForEach(items) { it in
                                Button {
                                    selection = it
                                    withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
                                        expanded = false
                                    }
                                } label: {
                                    HStack(alignment: .top) {
                                        Text(name(it))
                                            .multilineTextAlignment(.leading)
                                            .lineLimit(3)
                                            .fixedSize(horizontal: false, vertical: true)
                                        Spacer()
                                        if selection == it {
                                            Image(systemName: "checkmark")
                                                .foregroundColor(.blue)
                                        }
                                    }
                                    .padding(.vertical, 16)
                                    .padding(.horizontal, 16)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                .buttonStyle(.plain)
                                .allowsHitTesting(true)

                                if it.id != items.last?.id {
                                    Divider().padding(.horizontal, 16)
                                }
                            }
                        }
                    }
                    .frame(maxHeight: 400)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(.regularMaterial)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(Color(.quaternaryLabel), lineWidth: 1)
                    )
                    .transition(.opacity.combined(with: .scale(scale: 0.95)).combined(with: .move(edge: .top)))
                    .allowsHitTesting(true)
                    .zIndex(1000) // 更高的 zIndex
                    
                    Spacer()
                }
                .zIndex(1001) // 整个下拉容器的最高层级
            }
        }
    }// MARK: - Convenience Extensions
}
extension InlineDropdown {
    /// 便捷初始化器 - 使用内部管理的展开状态
    /// 注意：由于 SwiftUI 限制，这个初始化器不能直接提供内部状态管理
    /// 推荐使用 InlineDropdownWithInternalState 包装器
}

/// 包装器结构体，用于内部状态管理
struct InlineDropdownWithInternalState<Item: Identifiable & Hashable>: View {
    let title: String
    let items: [Item]
    @Binding var selection: Item?
    let name: (Item) -> String
    let placeholder: String
    let headerHidden: Bool
    
    @State private var expanded = false
    
    var body: some View {
        InlineDropdown(
            title: title,
            items: items,
            selection: $selection,
            name: name,
            placeholder: placeholder,
            headerHidden: headerHidden,
            expanded: $expanded
        )
    }
}