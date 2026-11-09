export default function PageHeading({ eyebrow, title, description }) {
  return (
    <section className="page-heading">
      <p className="eyebrow">
        <span />
        {eyebrow}
      </p>
      <h1>{title}</h1>
      <p className="page-description">{description}</p>
    </section>
  );
}
