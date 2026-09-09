import SocialLandingPage from "../components/SocialLandingPage.jsx";
import { getSocialLandingTopic } from "../lib/socialLandingTopics.js";

const topic = getSocialLandingTopic("verlustangst");

export const metadata = {
  title: topic.seoTitle,
  description: topic.seoDescription,
  robots: {
    index: false,
    follow: true,
  },
};

export default function VerlustangstPage() {
  return <SocialLandingPage topic={topic} />;
}