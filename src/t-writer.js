const defaultOptions = {
  loop: false,
  animateCursor: true,
  preventWordWrap: false,

  blinkSpeed: 400,

  typeSpeed: 90,
  deleteSpeed: 40,

  typeSpeedMin: 65,
  typeSpeedMax: 115,

  deleteSpeedMin: 40,
  deleteSpeedMax: 90,

  typeClass: 'type-span',
  cursorClass: 'cursor-span',

  typeColor: 'black',
  cursorColor: 'black',

  wordWrapLineLengthLimit: 0,

  onAddChar: () => {},
  onDeleteChar: () => {},
  onLastChar: () => {}
}

class Cursor {
  constructor(el, speed) {
    this.el = el
    this.speed = speed

    this.faded = false

    this.initialAssignment()
    this.el.addEventListener('transitionend', this.logic.bind(this))

    this.fade = this.fade.bind(this)
    this.fadeIn = this.fadeIn.bind(this)
  }

  initialAssignment () {
    Object.assign(this.el.style, {
      opacity: '1',
      'transition-duration': '0.1s'
    })
  }

  fade () {
    this
      .el
      .style
      .opacity = '0'

    this.faded = true
  }

  fadeIn () {
    this
      .el
      .style
      .opacity = '1'

    this.faded = false
  }

  logic () {
    this.faded
      ? setTimeout(this.fadeIn, this.speed)
      : setTimeout(this.fade, this.speed)
  }

  start () {
    setTimeout(this.fade.bind(this), 0)
  }
}

class Typewriter {
  constructor(el, options) {
    this.el = el
    this.text = ''
    //TODO - move these counters into closures in the helpers section
    this.extraSpaceCount = 0;
    this.extraNewlineCount = 0;
    this.lengthSinceNewLine = 0;
    this.queue = []
    this.options = Object.assign({}, defaultOptions, options)

    if (this.options.preventWordWrap && this.options.wordWrapLineLengthLimit < 1)
      throw Error("Line length limit must be greater than 0.")

    this.createTextEl()
  }

  // USER API
  // #region
  type (str) {
    this.queue.push({
      type: 'type',
      content: str
    })

    return this
  }

  //NOTE - adding unicode means delete now must be aware of unicode, but there's no support for that yet...
  typeUnicode (str) {
    this.queue.push({
      type: 'unicode',
      content: str
    })
  }

  strings (interval, ...arr) {
    arr.forEach((str, i) => {
      this.queue.push({
        type: 'type',
        content: str
      })

      if (interval) {
        this.queue.push({
          type: 'pause',
          time: interval
        })
      }

      if (i === arr.length - 1) return

      this.queue.push({
        type: 'deleteChars',
        count: str.length
      })
    })

    return this
  }

  remove (num) {
    this.queue.push({
      type: 'deleteChars',
      count: num
    })

    return this
  }

  clear () {
    this.queue.push({
      type: 'clear'
    })

    return this
  }

  clearText () {
    this.text = ''
    this.render()

    return this
  }

  queueClearText () {
    this.queue.push({
      type: 'clearText'
    })

    return this
  }

  clearQueue() {
    this.queue = []
    this.text = ''
    render()

    return this
  }

  rest (time) {
    this.queue.push({
      type: 'pause',
      time
    })

    return this
  }

  changeOps (options) {

    this.queue.push({
      type: 'changeOps',
      options
    })

    return this
  }

  then (cb) {
    this.queue.push({
      type: 'callback',
      cb
    })

    return this
  }

  removeCursor () {
    this.queue.push({
      type: 'deleteCursor'
    })

    return this
  }

  addCursor () {
    this.queue.push({
      type: 'createCursor'
    })

    return this
  }

  changeTypeColor(color) {
    this.queue.push({
      type: 'typeColor',
      color
    })

    return this
  }

  changeCursorColor(color) {
    this.queue.push({
      type: 'cursorColor',
      color
    })

    return this
  }

  changeTypeClass(className) {
    this.queue.push({
      type: 'typeClass',
      className
    })

    return this
  }

  changeCursorClass(className) {
    this.queue.push({
      type: 'cursorClass',
      className
    })

    return this 
  }

  start () {
    if (this.running) return

    if (!this.cursorEl) {
      this.createCursorEl()
    }

    this.running = true
    this.deleteAll().then(_ => this.loop(0))
  }
  // #endregion
  // ACTIONS (promises)
  // #region
  add(content, isUnicode = false) {
    let count = 0
    // If unicode, count must increase by 2; else, by 1
    const countDelta = isUnicode ? 2 : 1;
    let appendNewLine = false;
    if (this.text.length === 0) this.extraSpaceCount = this.extraNewlineCount = 0;
    let initialTextLength = this.text.length - this.extraSpaceCount - this.extraNewlineCount;
    let currentWordTrueBounds = {
      startIndex: 0,
      endIndex: 0,
    }
    this.timestamp = Date.now()

    //REVIEW - This function got scope-creeped, its logic needs to be
    //FIXME    re-implemented through more organized methods of
    //         singular purpose
    //         (e.g. shouldPrependNewline: bool, shouldAppendNewline: bool, helper methods...)
    const newlineToPreventWordWrap = (contentArg, countArg) => {
      const trueLength = contentArg.length + initialTextLength - this.extraSpaceCount - this.extraNewlineCount;
      // If printed content + printing content is within the limit, return nothing
      if (trueLength <= this.options.wordWrapLineLengthLimit)
        return '';

      const trueCount = countArg + initialTextLength;

      
      if (contentArg[countArg] === " ") {
        if (this.lengthSinceNewLine > 1 && this.lengthSinceNewLine % this.options.wordWrapLineLengthLimit === 1)
          appendNewLine = true;
        return '';
      }

      // If current char is last char of current word...
      if (trueCount > 0 && trueCount === currentWordTrueBounds.endIndex) {
        if (
          (this.lengthSinceNewLine === 0 && trueCount % (this.options.wordWrapLineLengthLimit) === 0) ||
          (this.lengthSinceNewLine > 0 && this.lengthSinceNewLine % (this.options.wordWrapLineLengthLimit) === 0)
          ) {
          appendNewLine = true;
          this.extraNewlineCount++;
          return '';
        }
      }

      // If current char is nth (n >= 2) char of the current word, return nothing
      //  (because newline prepend logic only needs to run between words and on the first char of a word)
      if (
        trueCount > currentWordTrueBounds.startIndex &&
        trueCount <= currentWordTrueBounds.endIndex
        )
        return '';

      const spaceBeforeWordIndex = contentArg.lastIndexOf(" ", countArg);

      const currentWordStartIndex = spaceBeforeWordIndex >= 0
        ? spaceBeforeWordIndex + 1
        : 0

      const spaceAfterWordIndex = contentArg.indexOf(" ", currentWordStartIndex);

      const currentWordEndIndex = spaceAfterWordIndex > 0
        ? spaceAfterWordIndex - 1
        : contentArg.length - 1

      const currentWordLength = currentWordEndIndex - currentWordStartIndex + 1;

      currentWordTrueBounds = {
        startIndex: currentWordStartIndex + initialTextLength,
        endIndex: currentWordEndIndex + initialTextLength
      }

      // If current char is 1st char of a word...
      if(trueCount === currentWordTrueBounds.startIndex) {
        // -> If current position + the length of this word will not surpass the limit, return nothing
        if (trueCount + currentWordLength < this.options.wordWrapLineLengthLimit)
          return '';

        // utility method
        const arrayRange = (floorLimit, ceilingLimit, delta) =>
          Array.from(
          { length: (ceilingLimit - floorLimit) / delta + 1 },
          (value, idx) => floorLimit + idx * delta
        );

        if (this.extraNewlineCount === 0) {
          // -> If limit would be surpassed while printing this word, return newline
          const mustPrependNewLine = arrayRange(currentWordTrueBounds.startIndex, currentWordTrueBounds.endIndex, countDelta)
            .some(x => x % (this.options.wordWrapLineLengthLimit) === 1);

          if (mustPrependNewLine) {
            this.extraNewlineCount++;
            return '\n';
          }
        } else if (this.lengthSinceNewLine > 1) {
          const mustPrependNewLine = arrayRange(this.lengthSinceNewLine, this.lengthSinceNewLine + currentWordLength - 1, countDelta)
          .some(x => x % (this.options.wordWrapLineLengthLimit) === 1);

          if (mustPrependNewLine) {
            this.extraNewlineCount++;
            return '\n';
          }
        }


        
        return '';
      }
    }

    return new Promise((resolve, _) => {

      const _step = () => {
        if (count === content.length) return resolve()

        const newStamp = Date.now()
        const change = newStamp - this.timestamp
        const pendingChar = (isUnicode ? `${content[count]}${content[count+1]}` : content[count]);

        if (change >= this.getTypeSpeed()) {
          let newLineCreated = false;
          if (this.options.preventWordWrap) {
            let prependNewLine = !!newlineToPreventWordWrap(content, count);
            this.addChar(
              (prependNewLine ? '\n' : '') +
              pendingChar +
              (appendNewLine ? '\n' : '')
            )
            newLineCreated = prependNewLine || appendNewLine;
          } else {
            this.addChar(pendingChar)
          }

          this.timestamp = newStamp
          if (newLineCreated || this.extraNewlineCount === 0) this.lengthSinceNewLine = 0
          appendNewLine = false
          count+=countDelta
          if (this.extraNewlineCount > 0) this.lengthSinceNewLine+=countDelta
        }
        requestAnimationFrame(_step)
      }

      requestAnimationFrame(_step)
    })
  }

  delete(count) {
    this.timestamp = Date.now()

    return new Promise((resolve, _) => {

      const _step = () => {
        if (count === 0) return resolve()

        const newStamp = Date.now()
        const change = newStamp - this.timestamp

        if (change >= this.getDeleteSpeed()) {
          this.deleteChar()
          this.timestamp = newStamp
          count--
        }
        requestAnimationFrame(_step)
      }

      requestAnimationFrame(_step)
    })
  }

  deleteAll() {
    return this.delete(this.text.length)
  }

  pause(time) {
    return new Promise((resolve, _) => {
      setTimeout(resolve, time)
    })
  }

  callback(cb) {
    return new Promise((resolve, _) => {
      cb()
      resolve()
    })
  }

  deleteCursor () {
    return new Promise((resolve, _) => {
      this.removeCursorEl()
      resolve()
    })
  }

  createCursor () {
    return new Promise((resolve, _) => {
      this.createCursorEl()
      resolve()
    })
  }

  clearTextAction () {
    return new Promise((resolve, _) => {
      this.clearText()
      resolve()
    })
  }

  changeOpsAction (options) {
    return new Promise((resolve, _) => {
      this.options = Object.assign(this.options, options)
      resolve()
    })
  }

  typeColor (color) {
    return new Promise ((resolve, _) => {
      this.textEl.style.color = color
      resolve()
    })
  }

  cursorColor (color) {
    return new Promise((resolve, _) => {
      this.cursorEl.style.color = color
      resolve()
    })
  }

  typeClass (className) {
    return new Promise ((resolve, _) => {
      this.textEl.className = className
      resolve()
    })
  }

  cursorClass (className) {
    return new Promise((resolve, _) => {
      this.cursorEl.className = className
      resolve()
    })
  }
  // #endregion
  // HELPERS
  // #region
  deleteChar() {
    this.text = this.text.slice(0, -1)
    this.options.onDeleteChar();
    this.render()
  }

  addChar(char) {
    this.text += char
    this.options.onAddChar();
    this.render()
  }

  getTypeSpeed() {
    const speed = this.options.typeSpeed

    if (typeof speed === 'number') {
      return speed
    }

    const max = this.options.typeSpeedMax
    const min = this.options.typeSpeedMin

    const random = Math.floor(Math.random() * (max - min))
    return random + min
  }

  getDeleteSpeed() {
    const speed = this.options.deleteSpeed

    if (typeof speed === 'number') {
      return speed
    }

    const max = this.options.deleteSpeedMax
    const min = this.options.deleteSpeedMin

    const random = Math.floor(Math.random() * (max - min))
    return random + min
  }

  step(idx) {
    const action = this.queue[idx]

    switch (action.type) {
      case 'type':
        return this.add(action.content)

      case 'unicode':
        return this.add(action.content, true)

      case 'deleteChars':
        return this.delete(action.count)

      case 'clear':
        return this.deleteAll()

      case 'pause':
        return this.pause(action.time)

      case 'callback':
        return this.callback(action.cb)

      case 'deleteCursor':
        return this.deleteCursor()

      case 'createCursor':
        return this.createCursor()

      case 'clearText':
        return this.clearTextAction()

      case 'changeOps':
        return this.changeOpsAction(action.options)

      case 'typeColor':
        return this.typeColor(action.color)
      
      case 'cursorColor':
        return this.cursorColor(action.color)

      case 'typeClass':
        return this.typeClass(action.className)
      
      case 'cursorClass':
        return this.cursorClass(action.className)
    }
  }

  loop(idx) {
    if (idx === this.queue.length) {
      this.running = false

      if (this.options.loop) {
        this.start()
      }
      return this.options.onLastChar()
    }

    this.step(idx).then(_ => {
      this.loop(idx + 1)
    })
  }

  createCursorEl() {
    if (typeof this.options.animateCursor === 'String') return

    this.cursorEl = document.createElement('span')
    this.cursorEl.innerHTML = '|'

    this
      .cursorEl
      .style
      .color = this.options.cursorColor

    this
      .cursorEl
      .classList
      .add(this.options.cursorClass)

    this.el.appendChild(this.cursorEl)

    if (this.options.animateCursor) {
      this.cursor = new Cursor(
        this.cursorEl, 
        this.options.blinkSpeed
      )
      
      this.cursor.start()
    }
  }

  removeCursorEl() {
    this
      .el
      .removeChild(this.cursorEl)

    this.cursorEl = null
  }

  createTextEl() {
    this.textEl = document.createElement('span')

    this
      .textEl
      .classList
      .add(this.options.typeClass)

    this
      .textEl
      .style
      .color = this.options.typeColor

    this.el.appendChild(this.textEl)
  }

  render() {
    this.textEl.innerHTML = this.text
  }
  // #endregion
}

export default Typewriter