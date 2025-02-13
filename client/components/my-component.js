import { LitElement, html, css } from 'https://cdn.jsdelivr.net/npm/lit@2/+esm';

class MyComponent extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 16px;
      font-family: Arial, sans-serif;
      color: #333;
    }
    h1 {
      color: #0078d4;
    }
  `;

  static properties = {
    name: { type: String },
  };

  constructor() {
    super();
    this.name = 'World';
  }

  render() {
    return html`
      <h1>Hello, ${this.name}!</h1>
      <p>This is the first Lit component.</p>
    `;
  }
}

// Register the custom element
customElements.define('my-component', MyComponent);