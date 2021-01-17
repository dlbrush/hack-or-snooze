// global storyList variable
let storyList = null;

// global currentUser variable
let currentUser = null;

// global var that will hold a jQuery object of the current article list the user is looking at
let $currentView = null;

$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $favoritedArticles = $('#favorited-articles');
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $navWelcome = $("#nav-welcome");

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for submitting a new story.
   * If successful we create a new story and add it to the top of the list
   */
  $submitForm.on('submit', async function(evt) {
    evt.preventDefault();

    //grab the required fields and put them in an object
    const newStory = {
      author: $('#author').val(),
      title: $('#title').val(),
      url: $('#url').val()
    };

    //Add story to API and get a story object back
    const storyObj = await storyList.addStory(currentUser, newStory);

    //Add story to stories list based on request return
    $allStoriesList.prepend(generateStoryHTML(storyObj));

    //Add story to User's own stories
    currentUser.addOwnStory(storyObj);
    
    //Reset and close the form
    $submitForm.trigger("reset");
    $submitForm.slideToggle();
  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function() {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function() {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function() {
    hideElements();
    await generateStories();
    $allStoriesList.show();
  });

  /**
   * Event handler for navigation to favorites list
   */

   $('#favorites').on('click', async function() {
    //Clear current view and show the loading view
    showLoading($favoritedArticles);

    //Set the current view to favorited articles
    $currentView = $favoritedArticles;


   })

  /**
   * Event handler for clicking submit to open story form
   */
  $('#submit-story').on('click', function() {
    $submitForm.slideToggle();
  })

  /**
   * Add a story to the user's favorites when it has not been favorited yet, and remove it if it has already been favorited
   */
  async function toggleFavorite(evt) {
    if ($(evt.target).hasClass('favorited')) {
      //Story ID passed to the delete function is located in the ID of the parent element
      await currentUser.deleteFavorite($(evt.target).parent().attr('id'));
    } else {
      await currentUser.addFavorite($(evt.target).parent().attr('id'));
    }

    //Toggle star style from solid to regular, and toggle the favorited class
    $(evt.target).toggleClass(['fas', 'far', 'favorited'])
  }

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      showNavForLoggedInUser();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories
    $allStoriesList.show();

    //Show the favorite and delete buttons
    showFavoriteButtons();

    // update the navigation bar
    showNavForLoggedInUser();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    //Set current view to all articles list
    $currentView = $allStoriesList

    // Show loading view in the all stories list
    showLoading($allStoriesList);

    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;

    //Clear the loading message
    hideLoading();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story) {
    let hostName = getHostName(story.url);

    // render story markup
    const $storyMarkup = $(`
      <li id="${story.storyId}">
        <i class="far fa-star favorite hidden"></i>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    //Give this LI an event listener for users to favorite the story
    $storyMarkup.on('click', '.favorite', toggleFavorite);


    //Add the favorited class and switch to a solid star if the ID of this story matches one in the user's favorites
    for (let favorite of currentUser.favorites) {
      if (favorite.storyId === story.storyId) {
        $storyMarkup.children('.favorite').toggleClass(['favorited', 'fas', 'far']);
      }
    }

    //Show the favorite button if the user is logged in
    if (currentUser) {
      showFavoriteButtons();
    }

    return $storyMarkup;
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $('#nav-user-profile').text(currentUser.username);
    $('#main-nav').show();
    $navWelcome.show();
  }

  //Toggles on the favorite button when the user is logged in 
  function showFavoriteButtons() {
    $('.favorite').show();
  }

  /**
   * Clears the current view and displays a loading message in the next one while it populates.
   * The passed argument should be a jQuery object representing the article list we want 
   * to show next
   */
  function showLoading($loadingView) {
    //Empty the current view
    $currentView.empty();

    //Show the loading view and append a loading message to it
    $loadingView.show();
    $loadingView.append('<h3>Loading...</h3>');
  }

  /**
   * Remove the loading message from the current view before we populate it
   */
  function hideLoading() {
    $currentView.empty();
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});
