// The shared picker shell: a styled trigger we draw, with the NATIVE control invisible on top of it.
//
// WHY THE NATIVE CONTROL SURVIVES. Prompt 23 chose <select> and <input type="date"> precisely so iOS
// supplies its own wheel and calendar, and that is still the right answer - nothing rendered here
// would be as good on a phone. But a native <select> cannot paint two colours in one option, and a
// native date input renders its own locale string ("Sep 4, 2026") that no CSS can reach. Joe asked
// for `NFL Week 1` in gold beside a grey range, and for `Friday, September 4, 2026`. So the FACE is
// ours and the CONTROL is still theirs: the real element is stretched over the whole pill at
// opacity 0, so every tap, every keyboard focus and every change event still lands on it.
//
// What that buys, and what it costs. The accessible name is unchanged - it comes from the <label
// htmlFor> in the page heading (prompt 45), and the face is aria-hidden so a screen reader is never
// told the value twice. Focus is visible because .picker:focus-within draws the ring on the wrapper.
// The cost is that the face and the control can disagree if anything ever sets the control's value
// without re-rendering; the URL is the source of truth on both pages, so a change navigates and the
// server re-renders the face - there is no client state to keep in sync.
//
// font-size: 16px on the control is not cosmetic. Mobile Safari zooms the page when a form control
// under 16px takes focus, and the control is invisible, so the zoom would look like the page lurching
// for no reason.

export default function Picker({ children, control, className = '' }) {
  return (
    <span className={`picker ${className}`.trim()}>
      <span className="pk-face" aria-hidden="true">
        {children}
        <span className="pk-caret" />
      </span>
      {control}
    </span>
  );
}
