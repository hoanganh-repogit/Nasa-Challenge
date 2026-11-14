import './App.css'

export default function App() {
  return (
    <main className="hello">
      <section className="hello__lead" aria-labelledby="title">
        <p className="caption">Sol 1 → Sol 5111 · Meridiani Planum, Mars</p>
        <h1 id="title">
          Built for 90 sols.
          <span className="hello__amber">It kept going for 5,111.</span>
        </h1>
        <p className="hello__body">
          Echoes of the Cosmos replays the Opportunity rover's recorded route and the instruments behind its
          discoveries. The journey is being built during NASA Space Apps 2026.
        </p>
      </section>

      <section id="about" className="hello__about" aria-labelledby="about-title">
        <h2 id="about-title">About the reconstruction</h2>
        <ul>
          <li>Night sky and light trail are illustrative; the rover drove by day.</li>
          <li>The route comes from the Opportunity traverse table of the MER Analyst's Notebook (PDS Geosciences Node), which is not a formally archived PDS product.</li>
        </ul>
      </section>

      <footer className="hello__footer">
        <p>
          Echoes of the Cosmos is an independent educational prototype created for NASA Space Apps Challenge 2026.
          Historical mission information and selected media are sourced from NASA/JPL/PDS as individually credited.
          The project is not an official NASA product and is not endorsed or reviewed by NASA. Replayed intermediate
          positions and cinematic effects may be reconstructions.
        </p>
      </footer>
    </main>
  )
}
