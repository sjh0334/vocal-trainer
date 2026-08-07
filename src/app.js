import "./styles.css";

const app = document.querySelector("#app");

if (app) {
  app.innerHTML = `
    <section class="app-shell">
      <p class="eyebrow">VOCAL TRAINER</p>
      <h1>听见自己的音高</h1>
      <p>实时跟唱、看懂偏差，练完知道下一步怎么练。</p>
    </section>
  `;
}
