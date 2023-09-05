import './App.css';
import logo from "./scope-india-logo-bird.jpg";
import scopelogo from "./snowpark-home-slider-logo-new.png"
function App() {
  return (
    <div>
    <header>
      <nav>
        <ul id='nav'>
          <li><a href='#' style={{color:"yellow"}}>Home</a></li>
          <li><a href='course.html'>Courses</a></li>
          <li><a href='placement.html'>Placement cell</a></li>
          <li><img src={logo} alt="logo" height='55px'/></li>
          <li><a href='know'>know scopeindia</a></li>
          <li><a href='contact.html'>contact us</a></li>
          <li><button id="reg"><a href='#'>Register Now</a></button></li>
        </ul>
      </nav>

    </header>
    
    <section>
      <div id="background">
        <div id="back">
          {/* <img src='https://scopeindia.org/images/slider_bg.jpg'/> */}
        </div>
          <div id='scopelogo'>
            <img src={scopelogo} alt="background image"  />
          </div>
      </div>




    </section>
    <div id="form-reg">
      <h1>Registration</h1>
      <p>It's just a matter of 60 days to an IT job!</p>
    </div>
    <section id="form-section">
    <form>
      <div id='form-div'>
        <div class="field-divison">
          <div class="decor">
            <div>
              <label><b>Full Name (required)</b></label>
            </div>
            <div>
              <input type='text' size={55}/>
            </div>
          </div>
          <div class="decor">
            <div>
              <label><b>Date of Birth (required)</b></label>
            </div>
            <div>
              <input type='text' size={55}/>
            </div>
          </div>
          <div class="decor">
            <div>
              <label for="gender"><b>Gender:</b></label><br></br>
              <input type="radio" id="male" name="gender"/>
              <label for="male">male</label>
              <input type="radio" id="female" name="gender"/>
              <label for="female">female</label>
            </div>
          </div>
          <div class="decor">
            <div>
              <label><b>Educational Qualification</b></label>
            </div>
            <div>
              <input type='text' size={55}/>
            </div>
          </div>
          <div class="decor">
            <div>
              <label><b>Choose your course (required)</b></label>
            </div>
            <div>
              <input type='text' size={55}/>
            </div>
          </div>
          <div class="decor">
            <div>
              <label><b>Mobile Number (required)</b></label>
            </div>
            <div>
              <input type='tel' size={55}/>
            </div>
          </div>
          <div class="decor">
            <div>
              <label><b>Email (required)</b></label>
            </div>
            <div>
              <input type='email' size={55}/>
            </div>
          </div>
        </div>
        <div class='field-divison'>
          <div class="decor">
            <div>
              <label><b>Guardian's Mobile</b></label>
            </div>
            <div>
              <input type='tel' size={55}/>
            </div>
          </div>
          <div class="decor">
            <div>
              <label for="Training Mode"><b>Training Mode (required)</b></label><br></br>
              <input type="radio" id="Live online" name="Training Mode"/>
              <label for="Live online">Live online</label>
              <input type="radio" id="Classroom" name="Training Mode"/>
              <label for="Classroom">Classroom</label>
            </div>
          </div>
          <div class="decor">
            <div>
              <label>name</label>
            </div>
            <div>
              <input type='text' size={55}/>
            </div>
          </div>
          <div class="decor">
            <div>
              <label>name</label>
            </div>
            <div>
              <input type='text' size={55}/>
            </div>
          </div>
          <div class="decor">
            <div>
              <label>name</label>
            </div>
            <div>
              <input type='text' size={55}/>
            </div>
          </div>
          <div class="decor">
            <div>
              <label>name</label>
            </div>
            <div>
              <input type='text' size={55}/>
            </div>
          </div>
          <div class="decor">
            <div>
              <label>name</label>
            </div>
            <div>
              <input type='text' size={55}/>
            </div>
          </div>
        </div>
      </div>
  </form>

    </section>
    </div>

  );
}



export default App;
