import { LitElement, html, css } from 'https://cdn.jsdelivr.net/npm/lit@2/+esm';

class TodoItem extends LitElement {
    static styles = css`
    :host {
      display: block; /* Ensure each item is on a new line */
    }
    li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      border-bottom: 1px solid #eee;
    }
    li.completed {
      text-decoration: line-through;
      color: #888;
    }
    .delete-btn {
      background-color: #ff4d4d;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
    }
    .delete-btn:hover {
      background-color: #cc0000;
    }
  `;

    static properties = {
        completed: { type: Boolean },
    };

    constructor() {
        super();
        this.completed = false;
    }

    handleToggleCompletion() {
        this.completed = !this.completed;
    }

    render() {
        return html`
      <li class=${this.completed ? 'completed' : ''}>
        <span @click=${this.handleToggleCompletion}>
          <slot></slot> <!-- Render the text content -->
        </span>
        <button class="delete-btn" @click=${() => this.remove()}>Delete</button>
      </li>
    `;
    }
}

customElements.define('todo-item', TodoItem);