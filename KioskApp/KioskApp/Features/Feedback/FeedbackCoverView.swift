import SwiftUI

struct FeedbackCoverView: View {
    var body: some View {
        ZStack {
            // Background color
            Color(.systemGroupedBackground)
                .ignoresSafeArea()
            
            // Main content - centered text
            VStack(spacing: 32) {
                // UNSW College text
                Text("UNSW College")
                    .font(.system(size: 48, weight: .bold))
                    .foregroundColor(.primary)
                    .multilineTextAlignment(.center)
                
                // Waiting message
                Text("Waiting for cases to be sent")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .navigationBarHidden(true)
        .navigationBarBackButtonHidden(true)
        .kioskDragBlock() // Disable drag gestures
        .allowsHitTesting(true) // Allow basic touch interactions but no complex gestures
    }
}

#Preview {
    FeedbackCoverView()
}
