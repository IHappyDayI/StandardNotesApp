import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { mergeRegister } from '@lexical/utils'
import {
  COMMAND_PRIORITY_NORMAL,
  PASTE_COMMAND,
  $getSelection,
  $createParagraphNode,
  $isRangeSelection,
  $setSelection,
  $isElementNode,
  LexicalNode,
  RangeSelection,
  SerializedLexicalNode
} from 'lexical'
import { $convertFromMarkdownString } from '@lexical/markdown'
import { $generateNodesFromSerializedNodes, $insertGeneratedNodes } from '@lexical/clipboard'
import { MarkdownTransformers } from '../../MarkdownTransformers'
import { $isQuoteNode, $isHeadingNode, HeadingNode } from '@lexical/rich-text'
import { $isCodeNode } from '@lexical/code'
import { $isCollapsibleTitleNode } from '../CollapsiblePlugin/CollapsibleTitleNode'

function shouldHandleMarkdownPaste(clipboardData: DataTransfer): boolean {
  // Lexical's native clipboard format preserves the actual node structure
  // (lists, formatting, custom nodes, etc.). Never reinterpret it as Markdown.
  if (clipboardData.types.includes('application/x-lexical-editor')) {
    return false
  }

  // Let Lexical's normal HTML paste handling deal with rich clipboard content.
  if (clipboardData.types.includes('text/html')) {
    return false
  }

  if (!clipboardData.types.includes('text/plain')) {
    return false
  }

  const text = clipboardData.getData('text/plain')

  if (!text.trim()) {
    return false
  }

  /*
   * Block-level Markdown
   */
  const hasHeading = /^ {0,3}#{1,6}\s+\S/m.test(text)

  const hasUnorderedList = /^\s{0,3}[-*+]\s+\S/m.test(text)

  const hasOrderedList = /^\s{0,3}\d+[.)]\s+\S/m.test(text)

  const hasBlockquote = /^ {0,3}>\s?\S/m.test(text)

  const hasFencedCodeBlock = /^ {0,3}(`{3,}|~{3,})/m.test(text)

  const hasHorizontalRule =
    /^ {0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/m.test(text)

  /*
   * Markdown tables.
   *
   * We require both a pipe-containing row and a separator row so that
   * ordinary prose containing "|" isn't interpreted as a table.
   */
  const hasTable =
    /^\s*\|?.+\|.+\|?\s*$/m.test(text) &&
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/m.test(text)

  /*
   * Inline Markdown
   */
  const hasLink = /\[[^\]\n]+\]\([^)]+\)/.test(text)

  const hasImage = /!\[[^\]\n]*\]\([^)]+\)/.test(text)

  const hasInlineCode = /`[^`\n]+`/.test(text)

  const hasBold =
    /(?:\*\*|__)(?=\S)([\s\S]*?\S)(?:\*\*|__)/.test(text)

  const hasItalic =
    /(?:^|[^\*])\*(?=\S)([^*\n]*?\S)\*(?!\*)/.test(text) ||
    /(?:^|[^_])_(?=\S)([^_\n]*?\S)_(?!_)/.test(text)

  return (
    hasHeading ||
    hasUnorderedList ||
    hasOrderedList ||
    hasBlockquote ||
    hasFencedCodeBlock ||
    hasHorizontalRule ||
    hasTable ||
    hasLink ||
    hasImage ||
    hasInlineCode ||
    hasBold ||
    hasItalic
  )
}

function isAtStartOfHeading(
  selection: RangeSelection,
): HeadingNode | null {
  if (!selection.isCollapsed() || selection.anchor.offset !== 0) {
    return null
  }

  const textNode = selection.anchor.getNode()

  let node: LexicalNode = textNode
  let heading: HeadingNode | null = null

  // Find heading ancestor.
  while (node.getParent() !== null) {
    if ($isHeadingNode(node)) {
      heading = node
      break
    }

    node = node.getParent()!
  }

  if (heading === null) {
    return null
  }

  // Ensure every node between the caret and heading
  // is the first child of its parent.
  node = textNode

  while (!node.is(heading)) {
    if (node.getPreviousSibling() !== null) {
      return null
    }

    node = node.getParent()!

    if (node === null) {
      return null
    }
  }

  return heading
}

function serializeNode(node: LexicalNode): SerializedLexicalNode {
  const serialized = node.exportJSON() as SerializedLexicalNode

  if ($isElementNode(node)) {
    serialized.children = node
      .getChildren()
      .map((child) => serializeNode(child))
  }

  return serialized
}

export default function MarkdownPastePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        PASTE_COMMAND,
        (event: ClipboardEvent) => {

          const clipboardData = event.clipboardData

          if (!clipboardData || !shouldHandleMarkdownPaste(clipboardData)) {
            return false
          }

          const text = clipboardData.getData('text/plain')
          if (!text) { return false }

          let selection = $getSelection()
          if (!$isRangeSelection(selection)) {
            return false
          }

          const topLevelNode = selection.focus.getNode().getTopLevelElement()

          if (
            $isQuoteNode(topLevelNode) ||
            $isCodeNode(topLevelNode) ||
            $isCollapsibleTitleNode(topLevelNode)
          ) {
            return false
          }

          const initialSelection = selection.clone()

          // Make sure the selection is not backwards, as that causes issues when inserting.
          if (selection.isBackward()) {
            const anchor = selection.anchor
            selection.anchor = selection.focus
            selection.focus = anchor
          }

          const tempParagraph = $createParagraphNode()

          $convertFromMarkdownString(
            text,
            MarkdownTransformers,
            tempParagraph,
            true,
          )

          const serializedChildren = tempParagraph
            .getChildren()
            .map((node) => serializeNode(node))

          // Restore the initial selection.
          $setSelection(initialSelection)

          selection = $getSelection()

          if (!$isRangeSelection(selection)) {
            return false
          }

          const generatedNodes =
            $generateNodesFromSerializedNodes(serializedChildren)

          const heading = isAtStartOfHeading(selection)
          console.log(heading)

          if (heading) {
            for (const node of generatedNodes) {
              heading.insertBefore(node, false)
            }
          } else {
            $insertGeneratedNodes(editor, generatedNodes, selection)
          }

          // TODO: verify test cases
          // * pasting into table
          // * pasting into list
          // * pasting into code block
          // * pasting into a link
          // * pasting into a quote
          // * pasting into a collapsible node
          // * pasting into a heading
          // * pasting complex markdown stuff
          // * pasting a simple string
          // * pasting an image
          // * pasting a link
          // * pasting at the beginning of a word
          // * pasting at the end of a word
          // * pasting in the middle of a word
          // * pasting when having selected a word
          // * pasting when having selected two words
          // * pasting when having selected two words spanning over two lines
          // * pasting when having selected different nodes than textNodes
          // * pasting when having selected an entire paragraph with the focus at the beginning of the paragraph
          // * trying to replace more than one paragraph node

          return true
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    )
  })

  return null
}
