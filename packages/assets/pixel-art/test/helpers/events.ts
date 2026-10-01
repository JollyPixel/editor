export function mouseEvent(
  type: string,
  clientX: number,
  clientY: number
): MouseEvent {
  return new MouseEvent(type, {
    button: 0,
    buttons: 1,
    clientX,
    clientY,
    bubbles: true
  });
}
