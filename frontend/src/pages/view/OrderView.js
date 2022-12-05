import { useState, useEffect } from "react";
import { Button, Stack } from "@mui/material";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Summary from "../../components/Summary/Summary";
import PlateView from "./PlateView";
import "../../styles/master.scss";
import { CenterWrapper } from "../../styles/CenterWrapper";
// import axios from 'axios'
// import { url } from "../../config/global.js";

export default function OrderView({ user }) {
  const [view, setView] = useState(0);
  const [summaryData, setSummaryData] = useState([]);

  const navigate = useNavigate();


  useEffect(() => {

  }, []);

  const addItem = (size, item) => {
    let summaryItem = {
      size: size,
      id: Math.floor(Math.random() * 10000),
      items: [...item],
    };
    console.log(summaryItem);
    setSummaryData([...summaryData, summaryItem]);
  };

  const toCheckout = () => {
    console.log("checking out");
    navigate(`checkout`, { state: { summaryData: [...summaryData] } });
  };
  const handleBtnClick = (v) => {
    setView(v);
  };

  const btnStyle = {
    width: '20ch'
  }


  if (view === 0) {
    return (
      <CenterWrapper>
      <div>
        <Stack spacing={5}>
        <div>
          <h3>Size:</h3>
          <Stack direction="row" spacing={2}>
            <Button sx={btnStyle} variant="contained" onClick={() => handleBtnClick(1)}>
              Bowl
            </Button>
            <Button sx={btnStyle} variant="contained" onClick={() => handleBtnClick(2)} fullWidth>
              Plate
            </Button>
            <Button sx={btnStyle} variant="contained" onClick={() => handleBtnClick(3)} fullWidth>
              Bigger Plate
            </Button>
          </Stack>
        </div>
        <div>
          <Summary data={summaryData} />
        </div>
        <Stack direction="row" justifyContent="space-between" >
          <Link to="/">
            <Button variant="outlined" color="secondary">
              Back
            </Button>
          </Link>
          <Button variant="contained" onClick={toCheckout}>
            CHECKOUT
          </Button>
        </Stack>
        
        </Stack>
      </div>
    </CenterWrapper>
    );
  } else {
    return (
      <CenterWrapper theWidth="90vw">
        <PlateView
          user={user}
          handleView={handleBtnClick}
          view={view}
          addItem={addItem}
        />
      </CenterWrapper>
    );
  }
}
