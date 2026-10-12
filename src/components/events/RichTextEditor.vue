<script setup>
import { computed, watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

const props = defineProps({
  modelValue: { type: String, default: '' },
  error: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const current = (ed) => (ed.isEmpty ? '' : ed.getHTML())

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({ heading: { levels: [2, 3] } }),
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow' } }),
  ],
  onUpdate: ({ editor: ed }) => emit('update:modelValue', current(ed)),
})

watch(
  () => props.modelValue,
  (v) => {
    const ed = editor.value
    if (ed && v !== current(ed)) ed.commands.setContent(v || '', false)
  },
)
onBeforeUnmount(() => editor.value?.destroy())

function setLink() {
  const ed = editor.value
  const prev = ed.getAttributes('link').href
  const url = window.prompt('Link URL', prev || 'https://')
  if (url === null) return
  if (url === '') return ed.chain().focus().extendMarkRange('link').unsetLink().run()
  ed.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

const buttons = computed(() => {
  const ed = editor.value
  if (!ed) return []
  return [
    { icon: 'mdi-format-bold', title: 'Bold', on: () => ed.chain().focus().toggleBold().run(), active: ed.isActive('bold') },
    { icon: 'mdi-format-italic', title: 'Italic', on: () => ed.chain().focus().toggleItalic().run(), active: ed.isActive('italic') },
    { icon: 'mdi-format-strikethrough', title: 'Strikethrough', on: () => ed.chain().focus().toggleStrike().run(), active: ed.isActive('strike') },
    { icon: 'mdi-link-variant', title: 'Link', on: setLink, active: ed.isActive('link') },
    { icon: 'mdi-format-header-2', title: 'Heading', on: () => ed.chain().focus().toggleHeading({ level: 2 }).run(), active: ed.isActive('heading') },
    { icon: 'mdi-format-quote-close', title: 'Quote', on: () => ed.chain().focus().toggleBlockquote().run(), active: ed.isActive('blockquote') },
    { icon: 'mdi-code-tags', title: 'Code', on: () => ed.chain().focus().toggleCode().run(), active: ed.isActive('code') },
    { icon: 'mdi-format-list-bulleted', title: 'Bullet list', on: () => ed.chain().focus().toggleBulletList().run(), active: ed.isActive('bulletList') },
    { icon: 'mdi-format-list-numbered', title: 'Numbered list', on: () => ed.chain().focus().toggleOrderedList().run(), active: ed.isActive('orderedList') },
    { icon: 'mdi-format-indent-decrease', title: 'Outdent', on: () => ed.chain().focus().liftListItem('listItem').run(), active: false },
    { icon: 'mdi-format-indent-increase', title: 'Indent', on: () => ed.chain().focus().sinkListItem('listItem').run(), active: false },
  ]
})
</script>

<template>
  <div class="rte" :class="{ 'rte--error': error }">
    <div class="rte__bar">
      <button
        v-for="b in buttons"
        :key="b.icon"
        type="button"
        class="rte__btn"
        :class="{ 'rte__btn--on': b.active }"
        :title="b.title"
        @click="b.on"
      >
        <i class="mdi" :class="b.icon"></i>
      </button>
      <span class="flex-1"></span>
      <button type="button" class="rte__btn" title="Undo" @click="editor?.chain().focus().undo().run()">
        <i class="mdi mdi-undo"></i>
      </button>
      <button type="button" class="rte__btn" title="Redo" @click="editor?.chain().focus().redo().run()">
        <i class="mdi mdi-redo"></i>
      </button>
    </div>
    <EditorContent :editor="editor" class="rte__content" />
  </div>
</template>

<style scoped>
.rte { border: 1px solid #d1d5db; border-radius: 10px; overflow: hidden; background: #fff; }
.rte--error { border-color: #dc2626; }
.rte__bar { display: flex; align-items: center; gap: 2px; padding: 6px 8px; background: #f4f5f7; flex-wrap: wrap; }
.rte__btn { width: 32px; height: 32px; border-radius: 6px; border: 0; background: transparent; color: #6b7280; cursor: pointer; font-size: 18px; display: inline-flex; align-items: center; justify-content: center; }
.rte__btn:hover { background: #e5e7eb; }
.rte__btn--on { background: #dbeafe; color: #2b7fff; }
.rte__content :deep(.ProseMirror) { min-height: 220px; padding: 14px 16px; outline: none; font-size: 15px; color: #111827; }
.rte__content :deep(.ProseMirror h2) { font-size: 20px; font-weight: 700; margin: 12px 0 6px; }
.rte__content :deep(.ProseMirror h3) { font-size: 17px; font-weight: 700; margin: 10px 0 4px; }
.rte__content :deep(.ProseMirror ul) { list-style: disc; padding-left: 22px; }
.rte__content :deep(.ProseMirror ol) { list-style: decimal; padding-left: 22px; }
.rte__content :deep(.ProseMirror blockquote) { border-left: 3px solid #d1d5db; padding-left: 12px; color: #4b5563; margin: 8px 0; }
.rte__content :deep(.ProseMirror code) { background: #f3f4f6; padding: 1px 5px; border-radius: 4px; font-family: monospace; }
.rte__content :deep(.ProseMirror a) { color: #2b7fff; text-decoration: underline; }
</style>
