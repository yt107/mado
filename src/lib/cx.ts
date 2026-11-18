// クラス名をつなげる。false や undefined は飛ばす（条件つきのクラスを書きやすくする）
export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
