import {Annotation, StateField} from '@codemirror/state'
import {AzureClient} from '@fluidframework/azure-client'
import {MergeTreeDeltaType, TextSegment} from '@fluidframework/merge-tree'
import {InsecureTokenProvider} from '@fluidframework/test-client-utils'
import {basicSetup, EditorView} from 'codemirror'
import {SharedString} from 'fluid-framework'
import './style.css'

// The Fluid schema defines the data types that are shared between clients.
const schema = {
  initialObjects: {
    content: SharedString
  }
}

const client = new AzureClient({
  connection: {
    type: 'remote',
    tenantId: import.meta.env.VITE_TENANT_ID,
    tokenProvider: new InsecureTokenProvider(import.meta.env.VITE_TENANT_KEY, {
      userId: 'userId' // The docs are not clear on whether this value is just arbitrary and for app-use-only, or what.
    }),
    endpoint: import.meta.env.VITE_ENDPOINT
  }
})

const isNew = location.pathname === '/'
const sid = isNew ? null : location.pathname.slice(1)

/** @type import('fluid-framework').IFluidContainer */
let container
/** @type import('@fluidframework/azure-client').AzureContainerServices */
let services

if (sid) {
  const containerResp = await client.getContainer(sid, schema)
  container = containerResp.container
  services = containerResp.services
} else {
  const containerResp = await client.createContainer(schema)
  container = containerResp.container
  services = containerResp.services
  const containerId = await container.attach()
  history.replaceState(null, '', `/${containerId}${location.search}`)
}

// Instantiate the CodeMirror editor.
const view = new EditorView({
  doc: container.initialObjects.content.getText(),
  parent: document.querySelector('#app'),
  extensions: [basicSetup, collabField(container.initialObjects.content)]
})

const isRemote = Annotation.define()

function collabField(sharedString) {
  return StateField.define({
    create: () => [],

    update: (value, tr) => {
      if (tr.annotation(isRemote)) {
        return []
      }

      tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        if (inserted.length) {
          sharedString.replaceText(fromA, toA, inserted.toString())
        } else {
          sharedString.removeText(fromA, toA)
        }
      })
    }
  })
}

function onSequenceDelta(event) {
  if (event.isLocal) {
    return
  }

  for (const range of event.ranges) {
    const segment = range.segment

    if (!TextSegment.is(segment)) {
      // TODO: Ignore markers, for now.
      continue
    }

    if (range.operation === MergeTreeDeltaType.INSERT) {
      const tr = view.state.update({
        changes: {
          from: range.position,
          insert: segment.text
        },

        annotations: [isRemote.of(true)]
      })

      view.dispatch(tr)
    } else if (range.operation === MergeTreeDeltaType.REMOVE) {
      const tr = view.state.update({
        changes: {
          from: range.position,
          to: range.position + segment.text.length,
          insert: ''
        },

        annotations: [isRemote.of(true)]
      })

      view.dispatch(tr)
    } else {
      console.warn('Unknown op type', range.operation)
    }
  }
}

container.initialObjects.content.on('sequenceDelta', onSequenceDelta)

const urlParams = new URLSearchParams(location.search)
const moby = urlParams.get('moby')

if (isNew && moby) {
  setTimeout(() => {
    insertMobyDick(moby)
  }, 1000)
}

async function insertMobyDick(count) {
  const source = localStorage.mobyDick.slice(
    0,
    count === 'all' ? 0 : parseInt(count, 10)
  )
  for (let ch of source) {
    const tr = view.state.update({
      changes: {
        from: view.state.doc.length,
        insert: ch
      }
    })

    view.dispatch(tr)

    await wait(randomBetween(0, 10))
  }
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min) + min)
}
