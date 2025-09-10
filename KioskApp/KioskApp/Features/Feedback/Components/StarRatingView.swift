import SwiftUI

public struct StarRatingView: View {
    @Binding var rating: Int        // 1...5
    public var max: Int = 5
    public var size: CGFloat = 36

    public init(rating: Binding<Int>, max: Int = 5, size: CGFloat = 36) {
        self._rating = rating
        self.max = max
        self.size = size
    }

    public var body: some View {
        HStack(spacing: 12) {
            ForEach(1...max, id: \.self) { i in
                Image(systemName: i <= rating ? "star.fill" : "star")
                    .font(.system(size: size))
                    .onTapGesture { rating = i }
                    .accessibilityLabel("\(i) star\(i > 1 ? "s" : "")")
            }
        }
    }
}
