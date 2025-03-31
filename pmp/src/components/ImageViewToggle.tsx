import { ChangeEventHandler } from "react";

export function ImageViewToggle(props: {
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <div style={{marginBottom: 12}}>
      <label>
        <input
          type="checkbox"
          checked={props.checked}
          onChange={props.onChange}
          style={{marginRight: 6}}
        />
        Show building images
      </label>
    </div>
  );
}
