import { Button } from "@mui/material";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import OrderView from "../view/OrderView";

export default function Customer() {
  return (
    <div>
      <Header name={"customer"} />;
      <OrderView user={"customer"} />
    </div>
  );
}
