import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { mergeRegister } from '@lexical/utils'
import {
  COMMAND_PRIORITY_NORMAL,
  PASTE_COMMAND,
  $getSelection,
  $createParagraphNode,
  $setSelection,
  $isRangeSelection,
} from 'lexical'
import { $convertFromMarkdownString } from '../../Lexical/Utils/MarkdownImport'
import { MarkdownTransformers } from '../../MarkdownTransformers'
import { $isQuoteNode } from '@lexical/rich-text'
import { $isCodeNode } from '@lexical/code'
import { $isCollapsibleTitleNode } from '../CollapsiblePlugin/CollapsibleTitleNode'

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
          if (!$isRangeSelection(selection)) {
            return false
          }

          const focusedNode = selection.focus.getNode()
          if ($isQuoteNode(focusedNode) || $isCodeNode(focusedNode) || $isCollapsibleTitleNode(focusedNode)) {
            return false
          }

          const text = event.clipboardData.getData('text/plain')

          // Make sure the selection is not backwards, as that causes issues when inserting.
          if (selection.isBackward()) {
            const anchor = selection.anchor
            selection.anchor = selection.focus
            selection.focus = anchor
          }

          // TODO: Handle case where an entire paragraph is selected
          // TODO: Maybe handle merging of nodes at the beginning and end of the pasted text. If you paste a heading into a normal text, there should be a linebreak I guess. Currently the heading gets converted to normal text.

          // Clear the selection to prevent issues when calling $convertFromMarkdownString() and the text is just simple, non-markdown text.
          $setSelection(null)

          const newNode = $createParagraphNode()

          $convertFromMarkdownString(text, MarkdownTransformers, newNode)

          const entireNodeSelected =
            selection.anchor.offset == 0 && selection.focus.getNode().getTextContentSize() == selection.focus.offset

          if (entireNodeSelected) {
            selection.anchor.offset = 1
            selection.insertNodes(newNode.getChildren())
            selection.anchor.offset = 0
            selection.deleteCharacter(false)
            // const previousSelection = $getPreviousSelection()
            // $setSelection(previousSelection.clone())
          } else {
            selection.insertNodes(newNode.getChildren())
          }

          // TODO: verify test cases
          // * pasting into table
          // * pasting into list
          // * pasting into code block
          // * pasting into a link
          // * pasting into a quote
          // * pasting into a collapsible node
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
