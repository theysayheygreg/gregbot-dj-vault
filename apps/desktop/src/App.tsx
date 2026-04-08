import { corpusVendors, northStar } from '@dj-vault/corpus';
import { designPillars } from '@dj-vault/core';

const priorities = [
  'Canonical local-first library and metadata engine',
  'Format adapters for Traktor, Rekordbox, Serato, Engine DJ, and future targets',
  'Research corpus for firmware, software packages, release notes, and USB/export behavior',
  'Hardware and workflow emulation for pre-gig confidence',
];

export function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">DJ Vault</p>
        <h1>{northStar.title}</h1>
        <p className="lede">{northStar.summary}</p>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Immediate build track</h2>
          <ul>
            {priorities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <h2>Design pillars</h2>
          <ul>
            {designPillars.map((pillar) => (
              <li key={pillar.id}>
                <strong>{pillar.name}</strong>
                <span>{pillar.summary}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="panel">
        <h2>Corpus lanes</h2>
        <div className="vendor-grid">
          {corpusVendors.map((vendor) => (
            <article className="vendor-card" key={vendor.slug}>
              <h3>{vendor.name}</h3>
              <p>{vendor.scope}</p>
              <p className="muted">Artifacts: {vendor.artifactTypes.join(', ')}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
