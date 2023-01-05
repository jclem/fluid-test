import {basicSetup, EditorView} from 'codemirror'
import './style.css'

new EditorView({
  parent: document.querySelector('#app'),
  extensions: [basicSetup]
})
