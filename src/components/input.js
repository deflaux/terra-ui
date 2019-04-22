import _ from 'lodash/fp'
import PropTypes from 'prop-types'
import { Component, createRef, Fragment, useRef } from 'react'
import Autosuggest from 'react-autosuggest'
import { createPortal, findDOMNode } from 'react-dom'
import { div, h } from 'react-hyperscript-helpers'
import Interactive from 'react-interactive'
import { search } from 'src/components/common'
import { icon } from 'src/components/icons'
import colors from 'src/libs/colors'
import * as Utils from 'src/libs/utils'


const styles = {
  input: {
    height: '2.25rem',
    border: `1px solid ${colors.grayBlue[2]}`, borderRadius: 4
  },
  suggestionsContainer: {
    position: 'fixed',
    maxHeight: 36 * 8 + 2, overflowY: 'auto',
    backgroundColor: 'white',
    border: `1px solid ${colors.grayBlue[2]}`
  },
  suggestion: {
    display: 'block', lineHeight: '2.25rem',
    paddingLeft: '1rem', paddingRight: '1rem',
    cursor: 'pointer'
  },
  textarea: {
    width: '100%', resize: 'none',
    border: `1px solid ${colors.grayBlue[2]}`, borderRadius: 4,
    fontSize: 14, fontWeight: 400,
    padding: '0.5rem 1rem',
    cursor: 'text'
  },
  validationError: {
    color: colors.red[0],
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    marginLeft: '1rem', marginTop: '0.5rem'
  }
}

export const textInput = props => h(Interactive,
  _.merge({
    as: 'input',
    className: 'focus-style',
    style: {
      ...styles.input,
      width: '100%',
      paddingLeft: '1rem', paddingRight: '1rem',
      fontWeight: 400, fontSize: 14,
      backgroundColor: props.disabled ? colors.grayBlue[4] : undefined
    }
  },
  props)
)

export const SearchInput = ({ onSearch = _.noop, onChange, ...props }) => {
  const supportsSearch = 'onsearch' in document.documentElement

  const searchEl = useRef()
  const attachRef = node => {
    if (node) {
      const el = findDOMNode(node)
      searchEl.current = el
      el.addEventListener('search', onSearch)
    } else {
      searchEl.current.removeEventListener('search', onSearch)
    }
  }

  return textInput(_.merge({
    ref: attachRef,
    type: 'search',
    spellCheck: false,
    style: { WebkitAppearance: 'none', borderColor: colors.gray[3] },
    onChange,
    onKeyDown: supportsSearch ? undefined : e => { // to make firefox behave like webkit/blink
      switch (e.which) {
        case 13: // return
          onSearch(e)
          break
        case 27: // escape
          e.persist()
          const touchedEvent = _.merge(e, { target: { value: '' } })
          onChange(touchedEvent)
          onSearch(touchedEvent)
          break
        default:
      }
    }
  }, props))
}


export const numberInput = props => {
  return h(Interactive, _.merge({
    as: 'input',
    type: 'number',
    className: 'focus-style',
    style: {
      ...styles.input,
      width: '100%',
      paddingLeft: '1rem',
      paddingRight: '0.25rem',
      fontWeight: 400,
      fontSize: 14
    }
  }, props))
}


export class IntegerInput extends Component {
  static propTypes = {
    min: PropTypes.number,
    max: PropTypes.number,
    onChange: PropTypes.func.isRequired
  }

  static defaultProps = {
    min: -Infinity,
    max: Infinity
  }

  constructor(props) {
    super(props)
    this.state = { textValue: undefined, lastValueProp: undefined } // eslint-disable-line react/no-unused-state
  }

  static getDerivedStateFromProps({ value }, { lastValueProp }) {
    if (value !== lastValueProp) {
      return { textValue: value.toString(), lastValueProp: value }
    }
    return null
  }

  render() {
    const { textValue } = this.state
    const { onChange, min, max, ...props } = this.props
    return numberInput({
      ...props, min, max, value: textValue,
      onChange: e => this.setState({ textValue: e.target.value }),
      onBlur: () => {
        const newValue = _.clamp(min, max, _.floor(textValue * 1))
        this.setState({ lastValueProp: undefined }) // eslint-disable-line react/no-unused-state
        onChange(newValue)
      }
    })
  }
}


/**
 * @param {object} props.inputProps
 * @param {object} [props.error] - error message content
 */
export const validatedInput = props => {
  const { inputProps, error } = props

  return h(Fragment, [
    div({
      style: { position: 'relative', display: 'flex', alignItems: 'center' }
    }, [
      textInput(_.merge({
        style: error ? {
          paddingRight: '2.25rem', // leave room for error icon
          border: `1px solid ${colors.red[0]}`
        } : undefined
      }, inputProps)),
      error && icon('exclamation-circle', {
        size: 24,
        style: {
          position: 'absolute', color: colors.red[0],
          right: '.5rem'
        }
      })
    ]),
    error && div({ style: styles.validationError }, [error])
  ])
}

class AutocompleteSuggestions extends Component {
  static propTypes = {
    containerRef: PropTypes.object.isRequired,
    containerProps: PropTypes.object,
    children: PropTypes.node
  }

  static defaultProps = {
    containerProps: {}
  }

  constructor(props) {
    super(props)
    this.el = document.createElement('div')
    this.state = { top: undefined, left: undefined, width: undefined }
  }

  componentDidMount() {
    document.getElementById('modal-root').appendChild(this.el)
    this.reposition()
    this.interval = setInterval(() => this.reposition(), 200)
  }

  componentWillUnmount() {
    document.getElementById('modal-root').removeChild(this.el)
    clearInterval(this.interval)
  }

  reposition() {
    const { containerRef } = this.props
    const { top, left, width } = containerRef.current.getBoundingClientRect()
    if (!_.isEqual({ top, left, width }, _.pick(['top', 'left', 'width'], this.state))) {
      this.setState({ top, left, width })
    }
  }

  render() {
    const { containerProps, children } = this.props
    const { top, left, width } = this.state
    return createPortal(
      div({
        ...containerProps,
        style: { ...styles.suggestionsContainer, top, left, width }
      }, [children]),
      this.el
    )
  }
}

/**
 * See {@link https://github.com/moroshko/react-autosuggest#props}
 */
export class AutocompleteTextInput extends Component {
  static propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    suggestions: PropTypes.arrayOf(PropTypes.string)
  }

  static defaultProps = {
    suggestions: []
  }

  constructor(props) {
    super(props)
    this.state = { show: false }
    this.containerRef = createRef()
    this.id = _.uniqueId('AutocompleteTextInput_')
  }

  render() {
    const { value, onChange, suggestions, style, ...props } = this.props
    const { show } = this.state
    return h(Autosuggest, {
      id: this.id,
      inputProps: { value, onChange: e => onChange(e.target.value) },
      suggestions: show ? (value ? _.filter(Utils.textMatch(value), suggestions) : suggestions) : [],
      onSuggestionsFetchRequested: () => this.setState({ show: true }),
      onSuggestionsClearRequested: () => this.setState({ show: false }),
      onSuggestionSelected: (e, { suggestionValue }) => onChange(suggestionValue),
      getSuggestionValue: _.identity,
      shouldRenderSuggestions: () => true,
      focusInputOnSuggestionClick: false,
      renderSuggestionsContainer: ({ containerProps, children }) => {
        return div({ ref: this.containerRef }, [
          children && h(AutocompleteSuggestions, { containerProps, children, containerRef: this.containerRef })
        ])
      },
      renderSuggestion: v => v,
      renderInputComponent: inputProps => {
        return textInput({ ...props, ...inputProps, style, type: 'search' })
      },
      theme: {
        container: { width: '100%' },
        suggestionsList: { margin: 0, padding: 0 },
        suggestion: styles.suggestion,
        suggestionHighlighted: { backgroundColor: colors.grayBlue[5] }
      }
    })
  }
}

export class AutocompleteSearch extends Component {
  static propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    onSuggestionSelected: PropTypes.func.isRequired,
    suggestions: PropTypes.array,
    renderSuggestion: PropTypes.func,
    renderInputComponent: PropTypes.func,
    theme: PropTypes.object
  }

  static defaultProps = {
    suggestions: [],
    renderSuggestion: _.identity
  }

  constructor(props) {
    super(props)
    this.state = { show: false }
    this.containerRef = createRef()
    this.id = _.uniqueId('AutocompleteSearch_')
  }

  render() {
    const { value, onChange, onSuggestionSelected, suggestions, renderSuggestion, renderInputComponent, theme, ...props } = this.props
    const { show } = this.state
    return h(Autosuggest, {
      id: this.id,
      inputProps: { value, onChange: e => onChange(e.target.value), ...props },
      suggestions: show ? (value ? [value, ..._.filter(Utils.textMatch(value), suggestions)] : suggestions) : [],
      onSuggestionsFetchRequested: () => this.setState({ show: true }),
      onSuggestionsClearRequested: () => this.setState({ show: false }),
      onSuggestionSelected: (e, { suggestionValue }) => onSuggestionSelected(suggestionValue),
      getSuggestionValue: _.identity,
      shouldRenderSuggestions: value => value.trim().length > 0,
      renderSuggestionsContainer: ({ containerProps, children }) => {
        return div({ ref: this.containerRef }, [
          children && h(AutocompleteSuggestions, { containerProps, children, containerRef: this.containerRef })
        ])
      },
      renderSuggestion,
      renderInputComponent: renderInputComponent || (inputProps => search({ inputProps })),
      theme: _.merge({
        container: { width: '100%' },
        suggestionsList: { margin: 0, padding: 0 },
        suggestion: styles.suggestion,
        suggestionHighlighted: { backgroundColor: colors.grayBlue[5] }
      }, theme)
    })
  }
}

export const TextArea = props => {
  return h(Interactive, _.merge({
    as: 'textarea',
    className: 'focus-style',
    style: styles.textarea
  }, props))
}
