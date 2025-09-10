import SwiftUI

struct InlineDropdown<Item: Identifiable & Hashable>: View {
    let title: String
    let items: [Item]
    @Binding var selection: Item?
    let name: (Item) -> String

    var placeholder: String = "Select"
    var headerHidden: Bool = false

    @State private var expanded = false

    var body: some View {
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

            if expanded {
                VStack(spacing: 0) {
                    ForEach(items) { it in
                        Button {
                            selection = it
                            withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
                                expanded = false
                            }
                        } label: {
                            HStack {
                                Text(name(it))
                                Spacer()
                                if selection == it {
                                    Image(systemName: "checkmark")
                                }
                            }
                            .padding(.vertical, 12)
                            .padding(.horizontal, 12)
                        }
                        .buttonStyle(.plain)

                        if it.id != items.last?.id {
                            Divider().padding(.leading, 12)
                        }
                    }
                }
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(.thinMaterial)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Color(.quaternaryLabel), lineWidth: 1)
                )
                .transition(.opacity.combined(with: .move(edge: .top)))
                .animation(.spring(response: 0.25, dampingFraction: 0.9), value: expanded)
                .zIndex(1)
            }
        }
    }
}
