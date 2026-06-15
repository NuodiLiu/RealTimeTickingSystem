import SwiftUI

struct FeedbackCoverView: View {
    var body: some View {
        ZStack {
            // Background image 
            Image("CoverViewBackground0")
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea()
            
            // Main content 
            VStack(spacing: 40) {
                // UNSW College Logo
                Image("UnswCollegeLogo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: 600, maxHeight: 400)
                
                // Waiting message
                Text("Waiting for cases to be sent")
                    .accessibilityIdentifier("feedback.coverTitle")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(Color(red: 0.0, green: 0.2, blue: 0.4))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(.white.opacity(0.9))
                    )
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .navigationBarHidden(true)
        .navigationBarBackButtonHidden(true)
        .allowsHitTesting(true) 
    }
}

#Preview {
    FeedbackCoverView()
}
