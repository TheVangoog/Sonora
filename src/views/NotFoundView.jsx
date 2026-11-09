import { Link } from "react-router";
import PageHeading from "../components/PageHeading.jsx";

export default function NotFoundView() {
  return (
    <>
      <PageHeading
        eyebrow="404"
        title="It is quiet here."
        description="This page does not exist. Let us get back to the music."
      />
      <Link className="back-link" to="/tuner">
        Back to the tuner →
      </Link>
    </>
  );
}
