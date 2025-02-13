import { LitElement, html, css } from 'https://cdn.jsdelivr.net/npm/lit@2/+esm';

class TodoList extends LitElement {
    static styles = css`
    :host {
      display: block;
      font-family: Arial, sans-serif;
      max-width: 400px;
      margin: 0 auto;
      padding: 20px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
    }
    h2 {
      color: #0078d4;
    }
    ul {
      list-style-type: none;
      padding: 0;
    }
  `;

    render() {
        return html`
      <h2>My Todo List</h2>
      <ul>
        <slot></slot> <!-- Remove the <li> wrapper here -->
      </ul>
    `;
    }
}

customElements.define('todo-list', TodoList);