import SwiftUI

public struct StarRatingView: View {
    @Binding var rating: Int        // 1...5
    public var max: Int = 5
    public var size: CGFloat = 36
    public var spacing: CGFloat = 16
    
    // UNSW 主题色
    private let unswYellow = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let unswDarkBlue = Color(red: 0.0, green: 0.2, blue: 0.4)

    public init(rating: Binding<Int>, max: Int = 5, size: CGFloat = 36, spacing: CGFloat = 16) {
        self._rating = rating
        self.max = max
        self.size = size
        self.spacing = spacing
    }

    public var body: some View {
        HStack(spacing: 0) {
            ForEach(1...max, id: \.self) { i in
                Button(action: {
                    rating = i
                }) {
                    Image(systemName: i <= rating ? "star.fill" : "star")
                        .font(.system(size: size, weight: .regular))
                        .foregroundColor(i <= rating ? unswYellow : Color(.systemGray3))
                        .shadow(color: i <= rating ? unswYellow.opacity(0.3) : Color.clear, radius: 4, x: 0, y: 2)
                }
                .scaleEffect(i <= rating ? 1.1 : 1.0)
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: rating)
                .accessibilityLabel("\(i) star\(i > 1 ? "s" : "")")
                .frame(maxWidth: .infinity) // 每个星星占据相等的宽度
            }
        }
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity) // 容器占满整个宽度
    }
}
