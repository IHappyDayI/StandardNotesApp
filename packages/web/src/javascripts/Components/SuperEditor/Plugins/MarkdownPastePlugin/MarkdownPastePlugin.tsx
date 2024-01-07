import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { mergeRegister } from '@lexical/utils'
import {
  COMMAND_PRIORITY_NORMAL,
  PASTE_COMMAND,
  $getSelection,
  $createParagraphNode,
  $isParagraphNode,
  $isTextNode,
  RangeSelection,
  $setSelection,
} from 'lexical'
import { $convertFromMarkdownString } from '../../Lexical/Utils/MarkdownImport'
import { MarkdownTransformers } from '../../MarkdownTransformers'
import { LexicalNode } from 'lexical/LexicalNode'

export default function MarkdownPastePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        PASTE_COMMAND,
        (event: ClipboardEvent) => {
          if (!event.clipboardData) {
            return false
          }

          const selection = $getSelection()
          if (!selection) {
            return false
          }

          const text = event.clipboardData.getData('text/plain')

          // Make sure the selection is not backwards, as that causes issues when inserting.
          const rangeSelection = selection as RangeSelection
          if (rangeSelection && rangeSelection.isBackward()) {
            const anchor = rangeSelection.anchor
            rangeSelection.anchor = rangeSelection.focus
            rangeSelection.focus = anchor
          }

          // TODO: Handle case where an entire paragraph is selcted
          // TODO: Maybe handle merging of nodes at the beginning and end of the pasted text. If you paste a heading into a normal text, there should be a linebreak I guess. Currently the heading gets converted to normal text.

          // Clear the selection to prevent issues when calling $convertFromMarkdownString() and the text is just simple, non-markdown text.
          $setSelection(null)

          const newNode = $createParagraphNode()
          $convertFromMarkdownString(text, MarkdownTransformers, newNode)
          selection.insertNodes(newNode.getChildren())

          // TODO: Verfy test cases
          // * pasting into table
          // * pasting into list
          // * pasting into code block
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

          return true
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    )
  })

  return null
}

const MARKDOWN_EMPTY_LINE_REG_EXP = /^\s{0,3}$/

function isEmptyParagraph(node: LexicalNode): boolean {
  if (!$isParagraphNode(node)) {
    return false
  }

  const firstChild = node.getFirstChild()
  return (
    firstChild == null ||
    (node.getChildrenSize() === 1 &&
      $isTextNode(firstChild) &&
      MARKDOWN_EMPTY_LINE_REG_EXP.test(firstChild.getTextContent()))
  )
}
