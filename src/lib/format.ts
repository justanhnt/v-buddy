export const VND = (n: number) =>
  n === 0 ? "Miễn phí" : new Intl.NumberFormat("vi-VN").format(n) + "đ";
